from typing import Dict, Set, Optional, Any
from fastapi import WebSocket

class SessionConnectionManager:
    """
    Manages in-memory WebSocket connections partitioned by session_id.
    """
    def __init__(self):
        # Maps session_id -> Set of active WebSocket connections
        self._session_rooms: Dict[str, Set[WebSocket]] = {}
        # Maps WebSocket connection -> connection metadata
        self._connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    def register(self, session_id: str, websocket: WebSocket, user_id: str, role: str) -> None:
        """
        Registers an accepted WebSocket connection into a session room.
        """
        if session_id not in self._session_rooms:
            self._session_rooms[session_id] = set()
        self._session_rooms[session_id].add(websocket)
        self._connection_metadata[websocket] = {
            "session_id": session_id,
            "user_id": user_id,
            "role": role
        }

    def remove(self, websocket: WebSocket) -> Optional[str]:
        """
        Removes a WebSocket connection and cleans up empty session rooms.
        Returns the session_id that the connection belonged to, if any.
        """
        metadata = self._connection_metadata.pop(websocket, None)
        if metadata:
            session_id = metadata["session_id"]
            if session_id in self._session_rooms:
                self._session_rooms[session_id].discard(websocket)
                if not self._session_rooms[session_id]:
                    del self._session_rooms[session_id]
            return session_id
        return None

    def get_session_connections(self, session_id: str) -> Set[WebSocket]:
        """
        Returns a copy of the active WebSocket set for a given session.
        """
        return self._session_rooms.get(session_id, set()).copy()

    def get_connection_count(self, session_id: Optional[str] = None) -> int:
        """
        Returns the number of active connections in a session or overall.
        """
        if session_id is not None:
            return len(self._session_rooms.get(session_id, set()))
        return sum(len(room) for room in self._session_rooms.values())

    async def broadcast_to_session(self, session_id: str, message: dict) -> None:
        """
        Broadcasts a JSON message to all active connections in a session room.
        """
        connections = self.get_session_connections(session_id)
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                self.remove(connection)

# Global singleton instance for the application
manager = SessionConnectionManager()
