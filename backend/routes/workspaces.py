"""
Spark Agent Hub — Workspace Routes
Full P3: branch listing, clean state, async switch, claim/release.
"""

from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException

import config
from config import AGENT_COLORS, WORKSPACE_PATHS
from models import SwitchBranchRequest, Workspace, WorkspaceStatus
from store import JsonStore
from svn_bridge import check_clean_state, detect_vcs, get_current_branch
from workspace_manager import (
    claim_workspace,
    find_available_workspace,
    get_workspace_detail,
    list_svn_branches,
    release_workspace,
    resolve_branch_url,
    switch_branch_async,
)
from ws_manager import ws_manager

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


# ── Helpers ───────────────────────────────────────────────────────

def _get_store() -> JsonStore:
    return JsonStore(config.WORKSPACES_FILE)


def _init_workspaces():
    """Initialize workspace registry if empty."""
    store = _get_store()
    if store.read_all():
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


def _enrich(ws_data: dict) -> dict:
    """Add live VCS info to workspace data."""
    path = ws_data.get("path", "")
    if path and Path(path).exists():
        ws_data["vcs_type"] = detect_vcs(path)
        ws_data["current_branch"] = get_current_branch(path)
    return ws_data


# ── Routes: List / Detail ─────────────────────────────────────────

@router.get("")
async def list_workspaces():
    """List all registered workspaces with live VCS info."""
    _init_workspaces()
    store = _get_store()
    return [_enrich(ws) for ws in store.read_all().values()]


@router.get("/branches")
async def get_branches():
    """
    List available SVN branches:
    - current (trunk URL)
    - work (feature branches)
    - rtm_roots (Build_XXXX)
    - rtm_clients (Build_XXXX_Customer_...)
    """
    return list_svn_branches()


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str):
    """Get a single workspace (basic info + live branch)."""
    _init_workspaces()
    store = _get_store()
    ws = store.read_one(workspace_id)
    if not ws:
        raise HTTPException(404, f"Workspace {workspace_id} not found")
    return _enrich(ws)


@router.get("/{workspace_id}/detail")
async def get_workspace_detail_route(workspace_id: str):
    """
    Full workspace detail: branch, clean state, modified file list.
    Slower than GET /{id} — runs svn status.
    """
    detail = get_workspace_detail(workspace_id)
    if not detail:
        raise HTTPException(404, f"Workspace {workspace_id} not found")
    return detail


# ── Routes: Refresh ───────────────────────────────────────────────

@router.post("/{workspace_id}/refresh")
async def refresh_workspace(workspace_id: str):
    """Re-read VCS status and persist to store."""
    _init_workspaces()
    store = _get_store()
    ws = store.read_one(workspace_id)
    if not ws:
        raise HTTPException(404, f"Workspace {workspace_id} not found")

    path = ws.get("path", "")
    if path and Path(path).exists():
        ws["vcs_type"] = detect_vcs(path)
        ws["current_branch"] = get_current_branch(path)
        is_clean, modified = check_clean_state(path)
        ws["is_clean"] = is_clean
        ws["modified_count"] = len(modified)
        store.write(workspace_id, ws)

    await ws_manager.broadcast("workspace_updated", {"workspace_id": workspace_id, **ws})
    return ws


# ── Routes: Claim / Release ───────────────────────────────────────

@router.post("/{workspace_id}/claim")
async def claim_workspace_route(workspace_id: str, body: dict):
    """
    Claim a workspace for a TT number.
    Body: {"tt_number": "1234"}
    """
    tt = body.get("tt_number", "")
    if not tt:
        raise HTTPException(400, "tt_number is required")

    success, message = claim_workspace(workspace_id, str(tt))
    if not success:
        raise HTTPException(409, message)

    await ws_manager.broadcast("workspace_updated", {
        "workspace_id": workspace_id,
        "status": "claimed",
        "task_tt": tt,
    })
    return {"success": True, "message": message}


@router.post("/{workspace_id}/release")
async def release_workspace_route(workspace_id: str):
    """Release a workspace back to available."""
    success, message = release_workspace(workspace_id)
    if not success:
        raise HTTPException(404, message)

    await ws_manager.broadcast("workspace_updated", {
        "workspace_id": workspace_id,
        "status": "available",
        "task_tt": None,
    })
    return {"success": True, "message": message}


# ── Routes: Branch Switch ─────────────────────────────────────────

@router.post("/{workspace_id}/switch")
async def switch_branch(workspace_id: str, req: SwitchBranchRequest, background_tasks: BackgroundTasks):
    """
    Async branch switch — resolves partial branch names, enforces clean state.
    The switch runs in the background; progress is streamed via WebSocket.
    Returns immediately with {"queued": true, "target_url": ...}.
    """
    _init_workspaces()
    store = _get_store()
    ws = store.read_one(workspace_id)
    if not ws:
        raise HTTPException(404, f"Workspace {workspace_id} not found")

    if ws.get("status") == WorkspaceStatus.switching.value:
        raise HTTPException(409, "Workspace is already switching")

    # Resolve branch name to URL
    target_url = resolve_branch_url(req.target_branch)
    if not target_url:
        raise HTTPException(400, f"Branch not found: {req.target_branch!r}")

    background_tasks.add_task(switch_branch_async, workspace_id, target_url, ws_manager)

    return {"queued": True, "workspace_id": workspace_id, "target_url": target_url}


# ── Routes: Available Workspace ───────────────────────────────────

@router.get("/available/first")
async def get_first_available():
    """Return the first available workspace ID."""
    _init_workspaces()
    ws_id = find_available_workspace()
    if not ws_id:
        raise HTTPException(503, "No available workspaces")
    return {"workspace_id": ws_id}
