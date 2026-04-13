"""
Spark Agent Hub — Configuration
All paths, constants, and environment-specific settings.
"""

from pathlib import Path
import os

# ── Hub Paths ──────────────────────────────────────────────────────
HUB_ROOT = Path(r"C:\AiHub")
BACKEND_DIR = HUB_ROOT / "backend"
DATA_DIR = BACKEND_DIR / "data"

WORKSPACES_FILE = DATA_DIR / "workspaces.json"
TASKS_FILE = DATA_DIR / "tasks.json"
HISTORY_FILE = DATA_DIR / "history.json"

# ── Existing Tools ─────────────────────────────────────────────────
TOOLS_DIR = Path(r"C:\Temp\dev\codebase-rag-builder")
MONDAY_CONFIG = TOOLS_DIR / "monday_config.json"
RAG_DIR = Path(r"C:\camtek\docs\rag")
FEATURES_DIR = TOOLS_DIR / "features"

# ── Workspaces ─────────────────────────────────────────────────────
RON_WORKSPACE = Path(r"C:\camtek")  # NEVER MODIFY

# Each workspace has two SVN repos: spark (AOI) and vscan90
WORKSPACE_REPOS = {
    "agent1": {"spark": Path(r"C:\spark1"),    "vscan": Path(r"C:\vscan90_1")},
    "agent2": {"spark": Path(r"C:\spark2"),    "vscan": Path(r"C:\vscan90_2")},
    "agent3": {"spark": Path(r"C:\spark3"),    "vscan": Path(r"C:\vscan90_3")},
}

# Backward-compat alias: primary path = spark repo
WORKSPACE_PATHS = {ws_id: repos["spark"] for ws_id, repos in WORKSPACE_REPOS.items()}

# ── Build Tools ────────────────────────────────────────────────────
MSBUILD_PATH = Path(
    r"C:\Program Files\Microsoft Visual Studio\2022\Professional"
    r"\MSBuild\Current\Bin\amd64\MSBuild.exe"
)
SOLUTION_RELATIVE = r"Build\Ace.sln"
TEST_SETTINGS_RELATIVE = r"Build\Tests\Tests.runsettings"

# ── Server ─────────────────────────────────────────────────────────
HUB_HOST = "0.0.0.0"
HUB_PORT = 8800

# ── Agent Color Identity ──────────────────────────────────────────
AGENT_COLORS = {
    "agent1": {"color": "blue",   "hex": "#4a9eff", "emoji": "\U0001f535", "label": "Agent 1"},
    "agent2": {"color": "green",  "hex": "#4ade80", "emoji": "\U0001f7e2", "label": "Agent 2"},
    "agent3": {"color": "orange", "hex": "#fb923c", "emoji": "\U0001f7e0", "label": "Agent 3"},
    "agent4": {"color": "purple", "hex": "#a78bfa", "emoji": "\U0001f7e3", "label": "Agent 4"},
    "agent5": {"color": "red",    "hex": "#f87171", "emoji": "\U0001f534", "label": "Agent 5"},
}

# ── Monday.com ─────────────────────────────────────────────────────
MONDAY_BOARD_ID = "4809670838"

# ── SVN ────────────────────────────────────────────────────────────
SVN_BASE = "https://svn/svn/pcb/AOI/Versions/SPARK/3.0"
SVN_CURRENT = f"{SVN_BASE}/Current"
SVN_RTM_ROOT = f"{SVN_BASE}/Release/!RTM"


def ensure_data_dir():
    """Create data directory if it doesn't exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
