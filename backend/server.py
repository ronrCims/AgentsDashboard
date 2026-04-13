"""
Spark Agent Hub — FastAPI Server
Entry point for the backend. Run with: python server.py
"""

import asyncio
import sys
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure backend directory is on the Python path
backend_dir = Path(__file__).parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import HUB_HOST, HUB_PORT, HUB_ROOT, ensure_data_dir
from ws_manager import ws_manager
from routes import workspaces, tasks, monday, history


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    ensure_data_dir()
    print(f"\n  Spark Agent Hub starting at http://localhost:{HUB_PORT}")
    print(f"  API docs at http://localhost:{HUB_PORT}/docs\n")
    yield
    # Shutdown (nothing needed for now)


# ── App Creation ───────────────────────────────────────────────────

app = FastAPI(
    title="Spark Agent Hub",
    description="Mission control for autonomous coding agents",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8800", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────

app.include_router(workspaces.router)
app.include_router(tasks.router)
app.include_router(monday.router)
app.include_router(history.router)


# ── WebSocket ──────────────────────────────────────────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, receive any client messages
            data = await websocket.receive_text()
            # Client can send ping/pong or commands in the future
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


# ── Health & Info ──────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "spark-agent-hub", "version": "0.1.0"}


@app.get("/api/info")
async def info():
    from config import MSBUILD_PATH, TOOLS_DIR, WORKSPACE_PATHS
    from monday_bridge import is_available as monday_available
    return {
        "msbuild_available": MSBUILD_PATH.exists(),
        "msbuild_path": str(MSBUILD_PATH),
        "tools_dir": str(TOOLS_DIR),
        "tools_available": TOOLS_DIR.exists(),
        "monday_available": monday_available(),
        "workspaces": {k: str(v) for k, v in WORKSPACE_PATHS.items()},
        "workspaces_exist": {k: v.exists() for k, v in WORKSPACE_PATHS.items()},
    }


# ── Activity Feed Endpoint ─────────────────────────────────────────

@app.get("/api/activity")
async def get_activity(limit: int = 50):
    """Get recent activity entries. In future, this will read from a persisted log."""
    # For now, activity is ephemeral (WebSocket only)
    # TODO: persist activity entries to a JSON file
    return []


# ── Serve Frontend (production build) ──────────────────────────────

frontend_dist = HUB_ROOT / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve React SPA for any non-API route."""
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))


# ── Run ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host=HUB_HOST,
        port=HUB_PORT,
        reload=True,
        reload_dirs=[str(backend_dir)],
    )
