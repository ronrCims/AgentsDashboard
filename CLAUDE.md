# CLAUDE.md - Spark Agent Hub

## Project Overview

The **Spark Agent Hub** is a local web dashboard + orchestrator for managing autonomous coding agents working on the Camtek AOI codebase (2.2M lines, C#/.NET Framework 4.7.2).

- **Location:** `C:\AiHub`
- **Backend:** Python 3.10, FastAPI, runs at `http://localhost:8800`
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS, dev server at `:5173`
- **Storage:** Local JSON files in `backend/data/`
- **Master spec:** `C:\claude.md` (the full system design document)

## Quick Start

```bash
# Backend
cd C:\AiHub\backend
pip install -r requirements.txt
python server.py                    # Starts FastAPI at :8800

# Frontend
cd C:\AiHub\frontend
npm install
npm run dev                         # Starts Vite dev server at :5173
```

## Project Structure

```
C:\AiHub\
├── CLAUDE.md                       # This file (project instructions for AI agents)
├── README.md                       # Project overview for humans
├── docs/
│   ├── plan.md                     # Implementation plan with phases and status
│   ├── status.md                   # Current status, what's done, what's next
│   └── api.md                      # API endpoint documentation
├── backend/
│   ├── server.py                   # FastAPI entry point + uvicorn runner
│   ├── config.py                   # Paths, constants, color identities
│   ├── models.py                   # Pydantic models for all data shapes
│   ├── store.py                    # Thread-safe JSON file persistence
│   ├── state_machine.py            # Task lifecycle transitions + guards
│   ├── workspace_manager.py        # VCS detection, branch ops, claim/release
│   ├── build_runner.py             # msbuild + vstest wrappers
│   ├── context_pipeline.py         # RAG selection, task brief generation
│   ├── orchestrator.py             # Pipeline execution, checkpoints
│   ├── monday_bridge.py            # Adapter importing monday_cli.py
│   ├── svn_bridge.py               # Adapter importing svn_merge.py
│   ├── ws_manager.py               # WebSocket connection tracking + broadcast
│   ├── requirements.txt            # Python dependencies
│   ├── routes/
│   │   ├── workspaces.py           # /api/workspaces endpoints
│   │   ├── tasks.py                # /api/tasks endpoints
│   │   ├── monday.py               # /api/monday endpoints
│   │   └── history.py              # /api/history endpoints
│   └── data/
│       ├── workspaces.json         # Workspace registry
│       ├── tasks.json              # Active tasks
│       └── history.json            # Completed task archive
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/                    # API client + typed endpoints
        ├── ws/                     # WebSocket hook + event types
        ├── store/                  # Zustand state management
        ├── components/             # React components
        └── lib/                    # Utilities (colors, formatters)
```

## Integration with Existing Tools

The Hub imports functions from existing tools at `C:\Temp\dev\codebase-rag-builder\`:

```python
import sys
sys.path.insert(0, r"C:\Temp\dev\codebase-rag-builder")
from monday_cli import get_item_by_tt, get_all_open_items, monday_query
from svn_merge import svn_run, find_tt_commits, find_rtm_branch
```

**DO NOT duplicate logic** that already exists in those tools. Import and wrap.

## Key Paths & Constants

| What | Path |
|------|------|
| Hub project | `C:\AiHub` |
| Existing tools | `C:\Temp\dev\codebase-rag-builder\` |
| Ron's workspace | `C:\camtek` (NEVER MODIFY) |
| Agent workspaces | `C:\agent1`, `C:\agent2`, `C:\agent3` |
| Monday config | `C:\Temp\dev\codebase-rag-builder\monday_config.json` |
| MSBuild (x64) | `C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\amd64\MSBuild.exe` |
| Hub port | 8800 |
| Frontend dev port | 5173 |

## Safety Rules (NEVER VIOLATE)

1. **NEVER modify C:\camtek** (except `.agent/` subdirectory for task briefs)
2. **NEVER auto-commit** to SVN or Git without Ron's explicit approval
3. **NEVER auto-update Monday.com** — only on Ron's command
4. **NEVER auto-push** to SVN trunk or any RTM branch
5. Before branch switch: ALWAYS verify clean state (no uncommitted changes)

## Code Conventions

- Backend: Python 3.10, type hints, Pydantic v2 models
- Frontend: React 19, TypeScript strict, Zustand for state, Tailwind for styling
- API: REST JSON, WebSocket for real-time events
- All config in `backend/config.py`, no hardcoded paths in other modules
- Existing tool imports go through bridge modules (`monday_bridge.py`, `svn_bridge.py`)

## Agent Color Identity System

| Agent | Color | Hex |
|-------|-------|-----|
| Agent 1 | Blue | #4a9eff |
| Agent 2 | Green | #4ade80 |
| Agent 3 | Orange | #fb923c |
| Agent 4+ | Purple, Red | #a78bfa, #f87171 |

## Build & Test

```bash
# Backend only
cd backend && python server.py

# Frontend dev
cd frontend && npm run dev

# Frontend production build
cd frontend && npm run build    # Output to frontend/dist/
```
