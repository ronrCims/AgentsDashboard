"""
Spark Agent Hub — Task Routes
CRUD + pipeline control for tasks.
"""

from datetime import datetime
from fastapi import APIRouter, HTTPException
from models import (
    Task, TaskStage, WorkspaceStatus,
    CreateTaskRequest, ApproveRequest, MessageRequest,
    GuidanceMessage, ActivityEntry,
)
from store import JsonStore
from ws_manager import ws_manager
from state_machine import can_transition, do_transition
import config

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _task_store() -> JsonStore:
    return JsonStore(config.TASKS_FILE)


def _ws_store() -> JsonStore:
    return JsonStore(config.WORKSPACES_FILE)


def _find_free_workspace() -> str | None:
    """Find first available workspace."""
    ws_store = _ws_store()
    for ws_id, ws_data in ws_store.read_all().items():
        if ws_data.get("status") == WorkspaceStatus.available.value:
            return ws_id
    return None


@router.get("")
async def list_tasks():
    """List all active tasks."""
    store = _task_store()
    all_tasks = store.read_all()
    return list(all_tasks.values())


@router.get("/{tt_number}")
async def get_task(tt_number: str):
    """Get full detail for a single task."""
    store = _task_store()
    task = store.read_one(tt_number)
    if not task:
        raise HTTPException(404, f"Task TT{tt_number} not found")
    return task


@router.post("")
async def create_task(req: CreateTaskRequest):
    """Assign a new task. Optionally auto-assigns a workspace."""
    store = _task_store()

    # Check if task already exists
    existing = store.read_one(req.tt_number)
    if existing:
        raise HTTPException(409, f"Task TT{req.tt_number} already exists")

    # Determine workspace
    workspace_id = req.workspace_id or _find_free_workspace()

    task = Task(
        tt_number=req.tt_number,
        task_type=req.task_type,
        autonomy=req.autonomy,
        workspace_id=workspace_id,
    )
    store.write(req.tt_number, task.model_dump())

    # Claim workspace if assigned
    if workspace_id:
        ws_store = _ws_store()
        ws_store.update(workspace_id, lambda ws: {
            **ws,
            "status": WorkspaceStatus.claimed.value,
            "task_tt": req.tt_number,
            "last_activity": datetime.now().isoformat(),
        })
        await ws_manager.broadcast("workspace_updated", {
            "workspace_id": workspace_id,
            "status": "claimed",
            "task_tt": req.tt_number,
        })

    # Broadcast task creation
    await ws_manager.broadcast("task_stage_changed", {
        "tt_number": req.tt_number,
        "stage": "queued",
        "workspace_id": workspace_id,
    })
    await ws_manager.broadcast("activity", {
        "workspace_id": workspace_id,
        "tt_number": req.tt_number,
        "message": f"TT{req.tt_number} assigned to {workspace_id or 'queue'}",
        "event_type": "task_assigned",
    })

    return task.model_dump()


@router.post("/{tt_number}/stage/{target_stage}")
async def advance_stage(tt_number: str, target_stage: TaskStage):
    """Advance a task to a new pipeline stage."""
    store = _task_store()
    task_data = store.read_one(tt_number)
    if not task_data:
        raise HTTPException(404, f"Task TT{tt_number} not found")

    task = Task(**task_data)
    success, reason = do_transition(task, target_stage)

    if not success:
        raise HTTPException(400, reason)

    store.write(tt_number, task.model_dump())

    # Update workspace status to match
    if task.workspace_id:
        ws_store = _ws_store()
        ws_status_map = {
            "implementing": "implementing",
            "building": "building",
            "testing": "testing",
            "review": "review",
            "completed": "available",
        }
        new_ws_status = ws_status_map.get(target_stage.value)
        if new_ws_status:
            ws_store.update(task.workspace_id, lambda ws: {
                **ws,
                "status": new_ws_status,
                "last_activity": datetime.now().isoformat(),
                "task_tt": None if target_stage == TaskStage.completed else ws.get("task_tt"),
            })

    await ws_manager.broadcast("task_stage_changed", {
        "tt_number": tt_number,
        "from_stage": task.stage_history[-1].from_stage if task.stage_history else None,
        "stage": target_stage.value,
        "workspace_id": task.workspace_id,
    })

    return task.model_dump()


@router.post("/{tt_number}/approve")
async def approve_checkpoint(tt_number: str, req: ApproveRequest):
    """Approve a checkpoint to advance the pipeline."""
    store = _task_store()
    task_data = store.read_one(tt_number)
    if not task_data:
        raise HTTPException(404, f"Task TT{tt_number} not found")

    task = Task(**task_data)

    # Add approval message
    msg = GuidanceMessage(
        timestamp=datetime.now().isoformat(),
        sender="Ron",
        content=f"{'Approved' if req.proceed else 'Rejected'}: {req.feedback or ''}".strip(),
    )
    task.guidance_messages.append(msg)
    task.updated_at = datetime.now().isoformat()
    store.write(tt_number, task.model_dump())

    await ws_manager.broadcast("activity", {
        "workspace_id": task.workspace_id,
        "tt_number": tt_number,
        "message": f"Checkpoint {'approved' if req.proceed else 'rejected'} by Ron",
        "event_type": "checkpoint_reached",
    })

    return task.model_dump()


@router.post("/{tt_number}/message")
async def send_guidance(tt_number: str, req: MessageRequest):
    """Send a guidance message to a running task."""
    store = _task_store()
    task_data = store.read_one(tt_number)
    if not task_data:
        raise HTTPException(404, f"Task TT{tt_number} not found")

    task = Task(**task_data)
    msg = GuidanceMessage(
        timestamp=datetime.now().isoformat(),
        sender="Ron",
        content=req.content,
    )
    task.guidance_messages.append(msg)
    task.updated_at = datetime.now().isoformat()
    store.write(tt_number, task.model_dump())

    await ws_manager.broadcast("guidance_received", {
        "tt_number": tt_number,
        "message": req.content,
    })

    return task.model_dump()


@router.post("/{tt_number}/pause")
async def pause_task(tt_number: str):
    """Pause a running task."""
    return await advance_stage(tt_number, TaskStage.paused)


@router.delete("/{tt_number}")
async def cancel_task(tt_number: str):
    """Cancel a task and release its workspace."""
    store = _task_store()
    task_data = store.read_one(tt_number)
    if not task_data:
        raise HTTPException(404, f"Task TT{tt_number} not found")

    workspace_id = task_data.get("workspace_id")

    # Release workspace
    if workspace_id:
        ws_store = _ws_store()
        ws_store.update(workspace_id, lambda ws: {
            **ws,
            "status": "available",
            "task_tt": None,
            "last_activity": datetime.now().isoformat(),
        })
        await ws_manager.broadcast("workspace_updated", {
            "workspace_id": workspace_id,
            "status": "available",
        })

    # Move to history (simple: just mark as failed/cancelled)
    task_data["stage"] = "failed"
    task_data["updated_at"] = datetime.now().isoformat()
    history_store = JsonStore(config.HISTORY_FILE)
    history_key = f"{tt_number}_{int(datetime.now().timestamp())}"
    history_store.write(history_key, task_data)

    # Remove from active
    store.delete(tt_number)

    await ws_manager.broadcast("activity", {
        "workspace_id": workspace_id,
        "tt_number": tt_number,
        "message": f"TT{tt_number} cancelled",
        "event_type": "task_completed",
    })

    return {"success": True, "tt_number": tt_number}
