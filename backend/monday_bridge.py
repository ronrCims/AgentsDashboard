"""
Spark Agent Hub — Monday.com Bridge
Imports and wraps functions from the existing monday_cli.py tool.
"""

import sys
from pathlib import Path
from config import TOOLS_DIR, MONDAY_PERSON

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
        GRP_OPEN,
        BOARD_ID,
        ITEM_FIELDS_LIGHT,
    )
    MONDAY_AVAILABLE = True
except ImportError as e:
    MONDAY_AVAILABLE = False
    _import_error = str(e)
    GRP_OPEN = None
    BOARD_ID = None
    ITEM_FIELDS_LIGHT = ""


def _get_all_open_large() -> list:
    """Fetch open items with a higher limit (500) to avoid truncation."""
    if not MONDAY_AVAILABLE:
        return []
    return get_group_items(GRP_OPEN, limit=500)


def _query_by_person(name: str) -> list:
    """
    Server-side query: get ALL board items where the people column contains name.
    Uses Monday API filtering — not limited by group or paginated fetch.
    Returns items from all groups (open, estimation, etc.).
    """
    if not MONDAY_AVAILABLE:
        return []
    # Query with contains_text filter on the 'people' column
    query = """
    query ($boardId: [ID!]!) {
      boards(ids: $boardId) {
        items_page(limit: 500, query_params: {
          rules: [{column_id: "people", compare_value: ["%s"], operator: contains_text}]
        }) {
          items { %s }
        }
      }
    }
    """ % (name.replace('"', '\\"'), ITEM_FIELDS_LIGHT)
    try:
        data = monday_query(query, {"boardId": [BOARD_ID]})
        boards = data.get("boards", [])
        if boards:
            return boards[0].get("items_page", {}).get("items", [])
    except Exception:
        pass
    return []


def _get_col(item: dict, col_id: str) -> str:
    """Extract a column value from a Monday.com item."""
    for col in item.get("column_values", []):
        if col.get("id") == col_id:
            return col.get("text", "") or ""
    return ""


def get_my_tasks(name: str = MONDAY_PERSON) -> list[dict]:
    """
    Get tasks where the person is engineer (people) or QA (people_127).
    Uses server-side Monday API filter for the people column (no pagination cap),
    then adds any QA-only items from the open group.
    """
    if not MONDAY_AVAILABLE:
        return []

    # Server-side filter: all items where people column contains name
    by_engineer = _query_by_person(name)
    engineer_ids = {i["id"] for i in by_engineer}

    # Also scan open group for QA role (people_127) — not filterable via API
    open_items = _get_all_open_large()
    name_lower = name.lower()
    by_qa = [
        item for item in open_items
        if item["id"] not in engineer_ids
        and name_lower in _get_col(item, "people_127").lower()
    ]

    return by_engineer + by_qa


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
    """Get all open tasks (up to 500)."""
    if not MONDAY_AVAILABLE:
        return []
    return _get_all_open_large()


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
