"""
Spark Agent Hub — Workspace Manager
Centralized workspace lifecycle: claim/release, branch switching, clean state.
All operations are safe by default — never touches C:\camtek.
"""

import asyncio
import subprocess
from datetime import datetime
from pathlib import Path

from config import WORKSPACE_PATHS, RON_WORKSPACE, SVN_CURRENT, SVN_RTM_ROOT, SVN_BASE
from models import WorkspaceStatus
from store import JsonStore
from svn_bridge import detect_vcs, get_current_branch, check_clean_state
import config


# ── Safety ────────────────────────────────────────────────────────

def _guard_not_ron(path: str) -> None:
    if Path(path).resolve() == RON_WORKSPACE.resolve():
        raise ValueError(f"SAFETY: Operation refused on Ron's workspace {RON_WORKSPACE}")


# ── Branch Discovery ──────────────────────────────────────────────

def list_svn_branches() -> dict:
    """
    List available SVN branches:
    - Current (trunk)
    - Work branches (feature branches)
    - RTM root branches (Build_XXXX)
    - RTM client branches (Build_XXXX_Customer_...)
    """
    branches = {
        "current": SVN_CURRENT,
        "work": [],
        "rtm_roots": [],
        "rtm_clients": [],
    }

    try:
        # List Work branches
        result = subprocess.run(
            ["svn", "list", f"{SVN_BASE}/Work"],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            branches["work"] = [
                l.rstrip("/").strip()
                for l in result.stdout.splitlines()
                if l.strip()
            ]
    except Exception:
        pass

    try:
        # List RTM root branches
        result = subprocess.run(
            ["svn", "list", SVN_RTM_ROOT],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode == 0:
            for line in result.stdout.splitlines():
                name = line.rstrip("/").strip()
                if not name:
                    continue
                full_url = f"{SVN_RTM_ROOT}/{name}"
                # Distinguish root RTMs (Build_XXXX) from client RTMs
                parts = name.split("_")
                if len(parts) <= 2:
                    branches["rtm_roots"].append({"name": name, "url": full_url})
                else:
                    branches["rtm_clients"].append({"name": name, "url": full_url})
    except Exception:
        pass

    return branches


def resolve_branch_url(branch_name: str) -> str | None:
    """
    Resolve a partial branch name or display name to a full SVN URL.
    Examples:
      "Current" -> SVN_CURRENT
      "1507"    -> finds Build_1507 or Build_1507_*
      "Build_1507_Adeon" -> finds exact or prefix match
    """
    if branch_name.lower() == "current":
        return SVN_CURRENT

    # If it already looks like a full URL, return as-is
    if branch_name.startswith("https://") or branch_name.startswith("^/"):
        return branch_name

    try:
        result = subprocess.run(
            ["svn", "list", SVN_RTM_ROOT],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return None

        candidates = [l.rstrip("/").strip() for l in result.stdout.splitlines() if l.strip()]

        # Exact match first
        for c in candidates:
            if c == branch_name:
                return f"{SVN_RTM_ROOT}/{c}"

        # Prefix/substring match
        matches = [c for c in candidates if branch_name in c]
        if len(matches) == 1:
            return f"{SVN_RTM_ROOT}/{matches[0]}"
        if len(matches) > 1:
            # Return closest match (shortest)
            return f"{SVN_RTM_ROOT}/{sorted(matches, key=len)[0]}"

        # Try Work branches
        result2 = subprocess.run(
            ["svn", "list", f"{SVN_BASE}/Work"],
            capture_output=True, text=True, timeout=30,
        )
        if result2.returncode == 0:
            work_branches = [l.rstrip("/").strip() for l in result2.stdout.splitlines() if l.strip()]
            work_matches = [b for b in work_branches if branch_name in b]
            if len(work_matches) == 1:
                return f"{SVN_BASE}/Work/{work_matches[0]}"

    except Exception:
        pass

    return None


# ── Workspace Lifecycle ───────────────────────────────────────────

def get_ws_store() -> JsonStore:
    return JsonStore(config.WORKSPACES_FILE)


def claim_workspace(workspace_id: str, tt_number: str) -> tuple[bool, str]:
    """
    Atomically claim a workspace for a task.
    Returns (success, message).
    """
    store = get_ws_store()
    ws = store.read_one(workspace_id)
    if not ws:
        return False, f"Workspace {workspace_id} not found"
    if ws.get("status") != WorkspaceStatus.available.value:
        return False, f"Workspace {workspace_id} is not available (status: {ws['status']})"

    store.update(workspace_id, lambda w: {
        **w,
        "status": WorkspaceStatus.claimed.value,
        "task_tt": tt_number,
        "last_activity": datetime.now().isoformat(),
    })
    return True, f"Workspace {workspace_id} claimed for TT{tt_number}"


def release_workspace(workspace_id: str) -> tuple[bool, str]:
    """
    Release a workspace back to available.
    Returns (success, message).
    """
    store = get_ws_store()
    ws = store.read_one(workspace_id)
    if not ws:
        return False, f"Workspace {workspace_id} not found"

    store.update(workspace_id, lambda w: {
        **w,
        "status": WorkspaceStatus.available.value,
        "task_tt": None,
        "last_activity": datetime.now().isoformat(),
    })
    return True, f"Workspace {workspace_id} released"


def find_available_workspace() -> str | None:
    """Return the first available workspace ID, or None."""
    store = get_ws_store()
    for ws_id, ws_data in store.read_all().items():
        if ws_data.get("status") == WorkspaceStatus.available.value:
            return ws_id
    return None


# ── Async Branch Switch ───────────────────────────────────────────

async def switch_branch_async(workspace_id: str, target_url: str, ws_manager) -> tuple[bool, str]:
    """
    Asynchronously switch a workspace to a target SVN URL.
    Streams progress lines via WebSocket during the switch.
    Returns (success, message).
    """
    store = get_ws_store()
    ws = store.read_one(workspace_id)
    if not ws:
        return False, "Workspace not found"

    path = ws.get("path", "")
    _guard_not_ron(path)

    if not Path(path).exists():
        return False, f"Path {path} does not exist"

    # Safety: check clean state
    is_clean, modified = check_clean_state(path)
    if not is_clean:
        msg = f"Workspace has {len(modified)} uncommitted change(s) — refusing to switch"
        await ws_manager.broadcast("workspace_updated", {
            "workspace_id": workspace_id,
            "status": "available",
            "error": msg,
            "modified_files": modified[:10],
        })
        return False, msg

    # Mark as switching
    store.update(workspace_id, lambda w: {
        **w,
        "status": WorkspaceStatus.switching.value,
        "last_activity": datetime.now().isoformat(),
    })
    await ws_manager.broadcast("workspace_updated", {
        "workspace_id": workspace_id,
        "status": "switching",
        "target_branch": target_url,
    })

    # Run SVN switch in subprocess, stream output
    try:
        proc = await asyncio.create_subprocess_exec(
            "svn", "switch", target_url, path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        lines_seen = 0
        async def stream_output():
            nonlocal lines_seen
            async for line in proc.stdout:
                decoded = line.decode("utf-8", errors="replace").rstrip()
                if decoded:
                    lines_seen += 1
                    await ws_manager.broadcast("workspace_switch_progress", {
                        "workspace_id": workspace_id,
                        "line": decoded,
                        "lines_seen": lines_seen,
                    })

        await asyncio.gather(stream_output(), proc.wait())
        stderr_output = await proc.stderr.read()

        if proc.returncode == 0:
            new_branch = get_current_branch(path)
            store.update(workspace_id, lambda w: {
                **w,
                "status": WorkspaceStatus.available.value,
                "current_branch": new_branch,
                "last_activity": datetime.now().isoformat(),
            })
            await ws_manager.broadcast("workspace_updated", {
                "workspace_id": workspace_id,
                "status": "available",
                "current_branch": new_branch,
                "message": f"Switched to {new_branch}",
            })
            return True, f"Switched to {new_branch}"
        else:
            err = stderr_output.decode("utf-8", errors="replace").strip()
            store.update(workspace_id, lambda w: {
                **w,
                "status": WorkspaceStatus.available.value,
                "last_activity": datetime.now().isoformat(),
            })
            await ws_manager.broadcast("workspace_updated", {
                "workspace_id": workspace_id,
                "status": "available",
                "error": err,
            })
            return False, f"Switch failed: {err}"

    except asyncio.CancelledError:
        store.update(workspace_id, lambda w: {**w, "status": WorkspaceStatus.available.value})
        return False, "Switch was cancelled"
    except Exception as e:
        store.update(workspace_id, lambda w: {**w, "status": WorkspaceStatus.available.value})
        return False, f"Switch error: {e}"


# ── Status Enrichment ─────────────────────────────────────────────

def get_workspace_detail(workspace_id: str) -> dict | None:
    """Get a workspace with full live details."""
    store = get_ws_store()
    ws = store.read_one(workspace_id)
    if not ws:
        return None

    path = ws.get("path", "")
    p = Path(path)
    ws["path_exists"] = p.exists()

    if p.exists():
        ws["vcs_type"] = detect_vcs(path)
        ws["current_branch"] = get_current_branch(path)
        is_clean, modified = check_clean_state(path)
        ws["is_clean"] = is_clean
        ws["modified_count"] = len(modified)
        ws["modified_files"] = modified[:20]  # cap at 20 for display
    else:
        ws["is_clean"] = None
        ws["modified_count"] = 0
        ws["modified_files"] = []

    return ws
