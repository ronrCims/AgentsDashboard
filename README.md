# Spark Agent Hub

Mission control dashboard for managing autonomous coding agents working on the Camtek AOI codebase.

## What Is This?

The Spark Agent Hub is a local web application that provides:

- **Agent Dashboard** — Real-time status of all coding agent workspaces with color-coded identity
- **Task Pipeline** — Visual pipeline tracking from Monday.com task assignment through implementation to review
- **Monday.com Integration** — Pull tasks, view priorities, assign to agents
- **Build & Test Control** — Trigger and monitor MSBuild/VSTest from the dashboard
- **Workspace Management** — SVN/Git branch switching, clean state verification
- **Context Pipeline** — RAG-powered task brief generation for Copilot handoff
- **Copilot Handoff** — Generate task briefs and launch VS with the right context

## Architecture

```
┌─────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)    :5173      │
│  Agent Cards, Task Queue, Activity Feed         │
└──────────────────┬──────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼──────────────────────────────┐
│  FastAPI Backend                     :8800      │
│  Routes, State Machine, Orchestrator            │
├─────────────┬──────────────┬────────────────────┤
│ Monday      │ SVN/Git      │ MSBuild/VSTest     │
│ Bridge      │ Bridge       │ Runner             │
└─────────────┴──────────────┴────────────────────┘
       │              │              │
  monday_cli.py  svn_merge.py   msbuild.exe
  (existing)     (existing)     (VS 2022)
```

## Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
python server.py

# Frontend (separate terminal)
cd frontend
npm install
npm run dev

# Open http://localhost:5173
```

## Implementation Status

See [docs/status.md](docs/status.md) for current progress and [docs/plan.md](docs/plan.md) for the full implementation plan.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Python 3.10, FastAPI, Pydantic v2 |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Zustand |
| Storage | Local JSON files |
| Real-time | WebSocket |
| Integrations | Monday.com API, SVN CLI, MSBuild, VSTest |

## Related

- **Master spec:** `C:\claude.md`
- **Existing tools:** `C:\Temp\dev\codebase-rag-builder\`
- **Camtek AOI codebase:** `C:\camtek\` (DO NOT MODIFY)
