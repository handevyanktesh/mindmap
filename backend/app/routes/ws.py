import json
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from app.api.deps import get_db, get_user_from_token
from app.services.connection_manager import manager

router = APIRouter()

@router.websocket("/sessions/{session_id}")
async def session_websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None),
    db = Depends(get_db)
):
    # 1. Extract and validate token
    if not token:
        # Check authorization header as fallback
        auth_header = websocket.headers.get("authorization")
        if auth_header and auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    user = get_user_from_token(token, db)
    if not user:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Unauthorized: Invalid or missing token"
        )
        return

    # 2. Resolve session and check active status
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Session not found"
        )
        return

    session_status = session.get("status")
    if session_status != "active":
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason=f"Session is {session_status}"
        )
        return

    # 3. Verify user authorization based on role
    role = user.get("role")
    if role == "student":
        # Must be an active participant in this session
        participant = db.participants.find_one({
            "session_id": session_id,
            "student_id": user["id"],
            "status": "joined"
        })
        if not participant:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Student is not an active participant in this session"
            )
            return
    elif role == "teacher":
        # Teacher must own the classroom associated with this session
        classroom = db.classrooms.find_one({"_id": session.get("classroom_id")})
        if not classroom or classroom.get("teacher_id") != user["id"]:
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Teacher does not own this classroom"
            )
            return
    else:
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Unauthorized role"
        )
        return

    # 4. Accept connection and register in manager
    await websocket.accept()
    manager.register(session_id, websocket, user["id"], role)

    # 5. Send initial session_connected message
    await websocket.send_json({
        "type": "session_connected",
        "session_id": session_id,
        "user_id": user["id"],
        "role": role
    })

    # 6. Message loop
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except (json.JSONDecodeError, ValueError):
                await websocket.send_json({
                    "type": "error",
                    "message": "Invalid JSON format"
                })
                continue

            msg_type = message.get("type")
            if msg_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unsupported message type: {msg_type}"
                })
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        manager.remove(websocket)
