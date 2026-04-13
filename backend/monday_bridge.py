"""
Spark Agent Hub — Monday.com Bridge
Imports and wraps functions from the existing monday_cli.py tool.
"""

import sys
from pathlib import Path
from config import TOOLS_DIR

# Add existing tools to Python path for importing
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

try:
    from monday_cli import (
        get_item_by_tt,
        search_items_by_name,
        get_all_open_items,
        get_group_items,
        monday_query,
        fmt_full,
        fmt_markdown,
    )
    MONDAY_AVAILABLE = True
except ImportError as e:
    MONDAY_AVAILABLE = False
    _import_error = str(e)


def _get_col(item: dict, col_id: str) -> str:
    """Extract a column value from a Monday.com item."""
    for col in item.get("column_values", []):
        if col.get("id") == col_id:
            return col.get("text", "") or ""
    return ""


def get_my_tasks(name: str = "Ron") -> list[dict]:
    """Get open tasks assigned to the specified person."""
    if not MONDAY_AVAILABLE:
        return []
    items = get_all_open_items()
    name_lower = name.lower()
    return [
        item for item in items
        if name_lower in _get_col(item, "people").lower()
    ]


def get_tt_details(tt_number: str) -> dict | None:
    """Get full details for a TT number."""
    if not MONDAY_AVAILABLE:
        return None
    items = get_item_by_tt(str(tt_number))
    return items[0] if items else None


def get_tt_markdown(tt_number: str) -> str | None:
    """Export a TT as markdown."""
    if not MONDAY_AVAILABLE:
        return None
    items = get_item_by_tt(str(tt_number))
    if not items:
        return None
    return fmt_markdown(items[0])


def search_tasks(query: str) -> list[dict]:
    """Search tasks by text."""
    if not MONDAY_AVAILABLE:
        return []
    return search_items_by_name(query)


def get_all_open() -> list[dict]:
    """Get all open tasks."""
    if not MONDAY_AVAILABLE:
        return []
    return get_all_open_items()


def extract_task_metadata(item: dict) -> dict:
    """Extract structured metadata from a Monday.com item."""
    return {
        "tt_number": _get_col(item, "text"),
        "name": item.get("name", ""),
        "status": _get_col(item, "status"),
        "engineer": _get_col(item, "people"),
        "priority": _get_col(item, "numbers3"),
        "task_type": _get_col(item, "text0"),
        "system": _get_col(item, "system"),
        "customer": _get_col(item, "customer"),
        "territory": _get_col(item, "territory9"),
        "sw_rev": _get_col(item, "sw_rev"),
        "due_date": _get_col(item, "date7"),
        "team": _get_col(item, "team"),
        "qa": _get_col(item, "people_127"),
        "monday_id": item.get("id", ""),
        "group": item.get("group", {}).get("title", ""),
    }


def is_available() -> bool:
    """Check if Monday.com integration is available."""
    return MONDAY_AVAILABLE
