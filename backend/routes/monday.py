"""
Spark Agent Hub — Monday.com Routes
Proxy endpoints for Monday.com data (read-only).
"""

from fastapi import APIRouter, HTTPException
from monday_bridge import (
    is_available, get_my_tasks, get_tt_details,
    get_tt_markdown, search_tasks, get_all_open,
    extract_task_metadata,
)

router = APIRouter(prefix="/api/monday", tags=["monday"])


@router.get("/status")
async def monday_status():
    """Check if Monday.com integration is available."""
    return {"available": is_available()}


@router.get("/my-tasks")
async def my_tasks(name: str = "Ron"):
    """Get open tasks assigned to the specified person."""
    if not is_available():
        raise HTTPException(503, "Monday.com integration not available")

    items = get_my_tasks(name)
    return [extract_task_metadata(item) for item in items]


@router.get("/open")
async def open_tasks():
    """Get all open tasks."""
    if not is_available():
        raise HTTPException(503, "Monday.com integration not available")

    items = get_all_open()
    return [extract_task_metadata(item) for item in items]


@router.get("/search")
async def search(q: str):
    """Search tasks by text."""
    if not is_available():
        raise HTTPException(503, "Monday.com integration not available")

    items = search_tasks(q)
    return [extract_task_metadata(item) for item in items]


@router.get("/{tt_number}")
async def get_tt(tt_number: str):
    """Get full details for a specific TT."""
    if not is_available():
        raise HTTPException(503, "Monday.com integration not available")

    item = get_tt_details(tt_number)
    if not item:
        raise HTTPException(404, f"TT{tt_number} not found in Monday.com")

    return extract_task_metadata(item)


@router.get("/{tt_number}/markdown")
async def get_tt_md(tt_number: str):
    """Export a TT as markdown."""
    if not is_available():
        raise HTTPException(503, "Monday.com integration not available")

    md = get_tt_markdown(tt_number)
    if not md:
        raise HTTPException(404, f"TT{tt_number} not found")

    return {"tt_number": tt_number, "markdown": md}
