"""
Spark Agent Hub — SVN/Git Bridge
Wraps VCS operations for workspace management.
Imports from existing svn_merge.py where possible.
"""

import subprocess
import sys
from pathlib import Path
from config import TOOLS_DIR, RON_WORKSPACE

# Import existing SVN tools
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

try:
    from svn_merge import (
        svn_run,
        svn_log,
        find_tt_commits,
        find_rtm_branch,
        list_rtm_branches,
        svn_list_dirs,
        SVN_CURRENT,
        SVN_RTM_ROOT,
        SVN_BASE,
    )
    SVN_TOOLS_AVAILABLE = True
except ImportError:
    SVN_TOOLS_AVAILABLE = False


def _assert_not_ron_workspace(path: str | Path):
    """Safety: never operate on Ron's workspace."""
    resolved = Path(path).resolve()
    if resolved == RON_WORKSPACE.resolve():
        raise ValueError(f"SAFETY: Cannot operate on Ron's workspace {RON_WORKSPACE}")


def detect_vcs(path: str | Path) -> str:
    """Detect VCS type for a workspace path. Returns 'svn', 'git', or 'unknown'."""
    p = Path(path)
    if (p / ".svn").exists():
        return "svn"
    if (p / ".git").exists():
        return "git"
    return "unknown"


def get_svn_info(workspace_path: str) -> dict:
    """Get SVN info for a workspace. Returns dict with url, revision, last_author, etc."""
    try:
        result = subprocess.run(
            ["svn", "info", workspace_path],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return {"error": result.stderr.strip()}

        info = {}
        for line in result.stdout.splitlines():
            if ": " in line:
                key, _, value = line.partition(": ")
                info[key.strip()] = value.strip()
        return info
    except Exception as e:
        return {"error": str(e)}


def get_current_branch(workspace_path: str) -> str | None:
    """Get the current branch/URL for a workspace."""
    vcs = detect_vcs(workspace_path)
    if vcs == "svn":
        info = get_svn_info(workspace_path)
        return info.get("Relative URL") or info.get("URL")
    elif vcs == "git":
        try:
            result = subprocess.run(
                ["git", "-C", workspace_path, "branch", "--show-current"],
                capture_output=True, text=True, timeout=10,
            )
            return result.stdout.strip() if result.returncode == 0 else None
        except Exception:
            return None
    return None


def get_workspace_status(workspace_path: str) -> list[str]:
    """Get list of modified/uncommitted files in a workspace."""
    vcs = detect_vcs(workspace_path)
    try:
        if vcs == "svn":
            result = subprocess.run(
                ["svn", "status", workspace_path],
                capture_output=True, text=True, timeout=30,
            )
            if result.returncode == 0:
                return [l for l in result.stdout.splitlines() if l.strip()]
        elif vcs == "git":
            result = subprocess.run(
                ["git", "-C", workspace_path, "status", "--porcelain"],
                capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0:
                return [l for l in result.stdout.splitlines() if l.strip()]
    except Exception:
        pass
    return []


def check_clean_state(workspace_path: str) -> tuple[bool, list[str]]:
    """Check if workspace has no uncommitted changes. Returns (is_clean, modified_files)."""
    modified = get_workspace_status(workspace_path)
    return len(modified) == 0, modified


def switch_branch_svn(workspace_path: str, target_url: str) -> tuple[bool, str]:
    """Switch an SVN workspace to a different branch. Returns (success, message)."""
    _assert_not_ron_workspace(workspace_path)

    # Safety: check for uncommitted changes first
    is_clean, modified = check_clean_state(workspace_path)
    if not is_clean:
        return False, f"Workspace has {len(modified)} uncommitted change(s). Refusing to switch."

    try:
        result = subprocess.run(
            ["svn", "switch", target_url, workspace_path],
            capture_output=True, text=True, timeout=600,  # can take minutes
        )
        if result.returncode == 0:
            return True, f"Switched to {target_url}"
        return False, f"Switch failed: {result.stderr.strip()}"
    except subprocess.TimeoutExpired:
        return False, "Switch timed out after 10 minutes"
    except Exception as e:
        return False, f"Switch error: {e}"


def find_commits_for_tt(tt_number: str) -> list[dict]:
    """Find SVN commits related to a TT number."""
    if not SVN_TOOLS_AVAILABLE:
        return []
    try:
        return find_tt_commits(str(tt_number))
    except Exception:
        return []


def list_available_rtms() -> list[str]:
    """List available RTM branches."""
    if not SVN_TOOLS_AVAILABLE:
        return []
    try:
        return list_rtm_branches()
    except Exception:
        return []
