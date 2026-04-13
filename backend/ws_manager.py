"""
Spark Agent Hub — WebSocket Manager
Tracks connections and broadcasts events to all connected clients.
"""

import json
import asyncio
from datetime import datetime
from typing import Any

from fastapi import WebSocket


class WebSocketManager:
    """Manages WebSocket connections and broadcasts events."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, event_type: str, data: dict[str, Any] | None = None):
        """Broadcast an event to all connected clients."""
        message = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            "data": data or {},
        }
        payload = json.dumps(message)

        # Send to all, remove dead connections
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(payload)
            except Exception:
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def send_to(self, websocket: WebSocket, event_type: str, data: dict[str, Any] | None = None):
        """Send an event to a specific client."""
        message = {
            "type": event_type,
            "timestamp": datetime.now().isoformat(),
            "data": data or {},
        }
        await websocket.send_text(json.dumps(message))


# Singleton instance
ws_manager = WebSocketManager()
