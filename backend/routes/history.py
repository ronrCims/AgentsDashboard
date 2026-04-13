"""
Spark Agent Hub — History Routes
Completed task log.
"""

from fastapi import APIRouter, HTTPException
from store import JsonStore
import config

router = APIRouter(prefix="/api/history", tags=["history"])


@router.get("")
async def list_history(limit: int = 50, offset: int = 0):
    """List completed tasks with pagination."""
    store = JsonStore(config.HISTORY_FILE)
    all_history = store.read_all()

    # Sort by timestamp (newest first)
    items = sorted(
        all_history.values(),
        key=lambda x: x.get("updated_at", ""),
        reverse=True,
    )

    total = len(items)
    page = items[offset:offset + limit]

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "items": page,
    }


@router.get("/{tt_number}")
async def get_history_item(tt_number: str):
    """Get a specific completed task from history."""
    store = JsonStore(config.HISTORY_FILE)
    all_history = store.read_all()

    # Find by TT number (keys include timestamp suffix)
    for key, item in all_history.items():
        if item.get("tt_number") == tt_number:
            return item

    raise HTTPException(404, f"TT{tt_number} not found in history")
