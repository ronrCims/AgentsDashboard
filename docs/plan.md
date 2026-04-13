# Spark Agent Hub — Implementation Plan

> Master spec: `C:\claude.md`
> This plan is the living implementation guide. Updated as phases complete.

## Phase Overview

| Phase | What | Key Files | Depends On |
|-------|------|-----------|------------|
| **P1** | Hub Backend (FastAPI core) | server.py, config.py, models.py, store.py, routes/*.py, monday_bridge.py, svn_bridge.py, ws_manager.py | — |
| **P2** | MVP Frontend (React SPA) | frontend/src/**/*.tsx, api/client.ts, ws/useWebSocket.ts | P1 |
| **P3** | Workspace Manager | workspace_manager.py, routes/workspaces.py (enhanced) | P1 |
| **P4** | Build & Test Runner | build_runner.py, routes/builds.py | P1 |
| **P5** | RAG & Context Pipeline | context_pipeline.py | P3 |
| **P6** | Orchestrator + Copilot Handoff | orchestrator.py, state_machine.py (enhanced) | P3, P4, P5 |
| **P7** | Feature Intelligence + E2E | Feature doc generation, real-task testing | P6 |

## P1: Hub Backend

### Goal
Running FastAPI server at :8800 with all REST endpoints, WebSocket, Monday.com integration, and JSON-based persistence.

### Files to Create

**Foundation:**
- `backend/config.py` — All paths, constants, MSBuild path, agent colors, existing tools directory
- `backend/models.py` — Pydantic v2 models: Workspace, Task, BuildResult, TestResult, ActivityEntry, StageTransition, etc.
- `backend/store.py` — Thread-safe JSON persistence with atomic writes (write to .tmp, os.replace)
- `backend/ws_manager.py` — WebSocket connection manager with broadcast

**Bridges:**
- `backend/monday_bridge.py` — Import monday_cli.py functions, wrap in async-compatible interface
- `backend/svn_bridge.py` — Import svn_merge.py functions, wrap SVN info/status queries

**State:**
- `backend/state_machine.py` — Task lifecycle transitions with guard functions

**API Routes:**
- `backend/routes/__init__.py`
- `backend/routes/workspaces.py` — GET/POST workspace endpoints
- `backend/routes/tasks.py` — Task CRUD + approve/message/pause/resume
- `backend/routes/monday.py` — Monday.com proxy endpoints
- `backend/routes/history.py` — Completed task log

**Entry Point:**
- `backend/server.py` — FastAPI app, CORS, route registration, WebSocket endpoint, startup init

**Data (auto-created):**
- `backend/data/workspaces.json`
- `backend/data/tasks.json`
- `backend/data/history.json`

### API Endpoints

```
GET  /api/workspaces              — list all workspaces with status
GET  /api/workspaces/{id}         — single workspace detail
POST /api/workspaces/{id}/refresh — re-read VCS status

GET  /api/tasks                   — list active tasks
GET  /api/tasks/{tt}              — task detail with history
POST /api/tasks                   — assign new task (body: {tt_number, workspace_id?, autonomy?})
POST /api/tasks/{tt}/approve      — approve checkpoint
POST /api/tasks/{tt}/message      — send guidance
POST /api/tasks/{tt}/pause        — pause task
POST /api/tasks/{tt}/resume       — resume task
DELETE /api/tasks/{tt}            — cancel task

GET  /api/monday/my-tasks         — Ron's open tasks
GET  /api/monday/{tt}             — TT details
GET  /api/activity                — recent activity entries

GET  /api/history                 — completed tasks

WS   /ws                          — real-time event stream
```

### Data Schemas

See `backend/models.py` for full Pydantic definitions. Key shapes:

**Workspace:** id, path, display_name, color, status (available|claimed|switching|ready|implementing|building|testing|review), vcs_type, current_branch, task_tt, last_activity

**Task:** tt_number, title, task_type, stage (queued|understanding|planning|preparing_env|implementing|building|testing|review|completed|paused|failed), autonomy, workspace_id, stage_history[], context_loaded[], build_result, test_result, guidance_messages[]

### Build Order
1. config.py + models.py (no deps)
2. store.py (depends on models)
3. monday_bridge.py + svn_bridge.py (depends on config)
4. ws_manager.py
5. state_machine.py (depends on models)
6. routes/ (depends on all above)
7. server.py (wires everything together)

---

## P2: MVP Frontend

### Goal
React SPA with dark theme showing agent cards, task pipeline, Monday task queue, activity feed, all updating in real-time via WebSocket.

### Key Components
- `AgentCard` — Color-coded card per workspace showing TT, branch, progress, stage, actions
- `PipelineProgress` — 7-stage horizontal bar
- `ActivityFeed` — Color-coded scrollable event list
- `TaskQueue` — Monday tasks table with sort/filter
- `TaskDetail` — Full task view with conversation, diff, build output, context panel
- `ContextPanel` — Sidebar showing loaded RAG/feature docs

### Tech Stack
- React 19, TypeScript, Vite, Tailwind CSS v4, Zustand v5
- React Router v7 for navigation
- Native WebSocket (no socket.io)

### Routes
- `/` — Dashboard (agent cards + activity feed)
- `/queue` — Monday task queue
- `/task/:tt` — Task detail
- `/history` — Completed tasks

---

## P3: Workspace Manager

### Goal
SVN/Git workspace management with safety checks. Claim/release lifecycle.

### Key Functions
- `detect_vcs(path)` — check .svn/ or .git/
- `get_current_branch(workspace)` — parse svn info or git branch
- `check_clean_state(workspace)` — verify no uncommitted changes
- `switch_branch(workspace, target)` — with safety (never touch C:\camtek)
- `claim_workspace(id, tt)` / `release_workspace(id)`

---

## P4: Build & Test Runner

### Goal
Trigger msbuild/vstest from the dashboard with output parsing and streaming.

### Key Details
- MSBuild path: `C:\Program Files\Microsoft Visual Studio\2022\Professional\MSBuild\Current\Bin\amd64\MSBuild.exe`
- Build command: `MSBuild.exe <workspace>\Build\Ace.sln /p:Configuration=Debug /p:Platform=x64`
- Test command: `vstest.console.exe <workspace>\Bin\<Tests>.dll /Settings:Build\Tests\Tests.runsettings /InIsolation`
- Stream output line-by-line via WebSocket
- Parse errors/warnings from MSBuild output

---

## P5: RAG & Context Pipeline

### Goal
Assemble task briefs with the right context from RAG docs, feature docs, and Monday data.

### Context Budget
| Task Size | Budget | What's Included |
|-----------|--------|-----------------|
| Small | ~2K tokens | Objective, affected files, specific instructions |
| Medium | ~8K tokens | + context, implementation approach, patterns |
| Large | ~15K tokens | Full plan, feature doc excerpts, per-file guidance |

---

## P6: Orchestrator + Copilot Handoff

### Goal
Drive tasks through the pipeline, manage checkpoints, generate .agent/ files, launch VS.

### Task Brief Output
Writes to `<workspace>\.agent\current-task.md` and `<workspace>\.agent\identity.txt`

### "Open in VS" Flow
`devenv.exe <workspace>\Build\Ace.sln`

---

## P7: Feature Intelligence + E2E

### Goal
AI-drafted feature docs, staleness detection, end-to-end testing on real TTs.
