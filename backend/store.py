"""
Spark Agent Hub — JSON File Persistence
Thread-safe read/write with atomic file replacement.
"""

import json
import os
import threading
from pathlib import Path
from typing import Any, Callable, Optional


class JsonStore:
    """Thread-safe JSON file store with atomic writes."""

    def __init__(self, path: Path):
        self._path = path
        self._lock = threading.Lock()
        # Ensure file exists with empty dict
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._write_raw({})

    def _read_raw(self) -> dict:
        try:
            with open(self._path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return {}

    def _write_raw(self, data: dict):
        tmp_path = self._path.with_suffix(".tmp")
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        os.replace(str(tmp_path), str(self._path))

    def read_all(self) -> dict:
        """Read all entries as a dict."""
        with self._lock:
            return self._read_raw()

    def read_one(self, key: str) -> Optional[dict]:
        """Read a single entry by key."""
        with self._lock:
            data = self._read_raw()
            return data.get(key)

    def write(self, key: str, value: dict):
        """Write or overwrite a single entry."""
        with self._lock:
            data = self._read_raw()
            data[key] = value
            self._write_raw(data)

    def delete(self, key: str) -> bool:
        """Delete an entry by key. Returns True if it existed."""
        with self._lock:
            data = self._read_raw()
            if key in data:
                del data[key]
                self._write_raw(data)
                return True
            return False

    def update(self, key: str, updater: Callable[[dict], dict]) -> Optional[dict]:
        """Atomic read-modify-write. updater receives the current value, returns the new value."""
        with self._lock:
            data = self._read_raw()
            if key not in data:
                return None
            data[key] = updater(data[key])
            self._write_raw(data)
            return data[key]

    def write_all(self, data: dict):
        """Replace entire store contents."""
        with self._lock:
            self._write_raw(data)
