"""
Spark Agent Hub — Workspace Routes
GET/POST endpoints for workspace management.
"""

from fastapi import APIRouter, HTTPException
from models import Workspace, WorkspaceStatus, SwitchBranchRequest
from config import WORKSPACE_PATHS, AGENT_COLORS
from store import JsonStore
from ws_manager import ws_manager
from svn_bridge import detect_vcs, get_current_branch, check_clean_state, get_svn_info
import config

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


def _get_store() -> JsonStore:
    return JsonStore(config.WORKSPACES_FILE)


def _init_workspaces():
    """Initialize workspace registry if empty."""
    store = _get_store()
    existing = store.read_all()
    if existing:
        return

    for ws_id, ws_path in WORKSPACE_PATHS.items():
        colors = AGENT_COLORS.get(ws_id, AGENT_COLORS["agent1"])
        workspace = Workspace(
            id=ws_id,
            path=str(ws_path),
            display_name=colors["label"],
            color=colors["color"],
            color_hex=colors["hex"],
            vcs_type=detect_vcs(ws_path) if ws_path.exists() else "unknown",
        )
        store.write(ws_id, workspace.model_dump())


def _enrich_workspace(ws_data: dict) -> dict:
    """Add live VCS info to workspace data."""
    path = ws_data.get("path", "")
    if path and Path(path).exists():
        ws_data["vcs_type"] = detect_vcs(path)
        ws_data["current_branch"] = get_current_branch(path)
    return ws_data


from pathlib import Path


@router.get("")
async def list_workspaces():
    """List all registered workspaces with current status."""
    store = _get_store()
    _init_workspaces()
    all_ws = store.read_all()
    return [_enrich_workspace(ws) for ws in all_ws.values()]


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str):
    """Get details for a single workspace."""
    store = _get_store()
    ws = store.read_one(workspace_id)
    if not ws:
        raise HTTPException(404, f"Workspace {workspace_id} not found")
    return _enrich_workspace(ws)


@router.post("/{workspace_id}/refresh")
async def refresh_workspace(workspace_id: str):
    """Re-read VCS status for a workspace."""
    store = _get_store()
    ws = store.read_one(workspace_id)
    if not ws:
        raise HTTPException(404, f"Workspace {workspace_id} not found")

    path = ws.get("path", "")
    if path and Path(path).exists():
        ws["vcs_type"] = detect_vcs(path)
        ws["current_branch"] = get_current_branch(path)
        is_clean, modified = check_clean_state(path)
        ws["_clean"] = is_clean
        ws["_modified_count"] = len(modified)
        store.write(workspace_id, ws)

    await ws_manager.broadcast("workspace_updated", {"workspace_id": workspace_id, **ws})
    return ws


@router.post("/{workspace_id}/switch")
async def switch_workspace_branch(workspace_id: str, req: SwitchBranchRequest):
    """Switch workspace to a different branch."""
    from svn_bridge import switch_branch_svn

    store = _get_store()
    ws = store.read_one(workspace_id)
    if not ws:
        raise HTTPException(404, f"Workspace {workspace_id} not found")

    path = ws.get("path", "")
    if not path or not Path(path).exists():
        raise HTTPException(400, f"Workspace path {path} does not exist")

    # Update status to switching
    ws["status"] = WorkspaceStatus.switching.value
    store.write(workspace_id, ws)
    await ws_manager.broadcast("workspace_updated", {"workspace_id": workspace_id, "status": "switching"})

    # Perform switch
    success, message = switch_branch_svn(path, req.target_branch)

    if success:
        ws["status"] = WorkspaceStatus.available.value
        ws["current_branch"] = get_current_branch(path)
    else:
        ws["status"] = WorkspaceStatus.available.value  # revert status

    store.write(workspace_id, ws)
    await ws_manager.broadcast("workspace_updated", {"workspace_id": workspace_id, "success": success, "message": message})

    if not success:
        raise HTTPException(400, message)
    return {"success": True, "message": message, "workspace": ws}
