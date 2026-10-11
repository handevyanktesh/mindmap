import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from app.api.deps import get_db, get_user_from_token
from app.services.connection_manager import manager

ALLOWED_ENGAGEMENT_STATES = {
    "NORMAL_BEHAVIOUR",
    "REDUCED_ENGAGEMENT_LIKE",
    "UNCERTAIN"
}

ALLOWED_CONFUSION_SIGNALS = {
    "LOW",
    "ELEVATED",
    "UNCERTAIN"
}

FORBIDDEN_BIOMETRIC_FIELDS = {
    "landmarks", "landmark", "ear", "gaze", "pose", "head_pose",
    "temporal", "baseline", "video", "frame", "image", "raw"
}

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
            elif msg_type == "student_behaviour_update":
                # 1. Role verification: Only students may send telemetry
                if role != "student":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Only students may send behavioural updates"
                    })
                    continue

                # 2. Check active session status in DB
                curr_session = db.sessions.find_one({"_id": session_id})
                if not curr_session or curr_session.get("status") != "active":
                    await websocket.send_json({
                        "type": "error",
                        "message": "Session is not active"
                    })
                    continue

                # 3. Check active participant status in DB
                active_part = db.participants.find_one({
                    "session_id": session_id,
                    "student_id": user["id"],
                    "status": "joined"
                })
                if not active_part:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Student is not an active participant in this session"
                    })
                    continue

                # 4. Check payload object presence
                payload = message.get("payload")
                if not isinstance(payload, dict):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Missing required payload object"
                    })
                    continue

                # 5. Check for forbidden biometric fields in message and payload
                all_keys = list(message.keys()) + list(payload.keys())
                has_forbidden = any(
                    any(fb in k.lower() for fb in FORBIDDEN_BIOMETRIC_FIELDS)
                    for k in all_keys
                )
                if has_forbidden:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid message: extra biometric fields are not permitted"
                    })
                    continue

                # 6. Validate required fields presence
                required_payload_keys = {"engagement_state", "confusion_signal", "confidence"}
                payload_keys = set(payload.keys())
                if not required_payload_keys.issubset(payload_keys):
                    await websocket.send_json({
                        "type": "error",
                        "message": "Missing required fields (engagement_state, confusion_signal, confidence)"
                    })
                    continue

                # Enforce strict payload: only engagement_state, confusion_signal, confidence
                if payload_keys != required_payload_keys:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid message: payload contains unexpected fields"
                    })
                    continue

                engagement_state = payload.get("engagement_state")
                confusion_signal = payload.get("confusion_signal")
                confidence = payload.get("confidence")

                # 7. Validate enum values
                if engagement_state not in ALLOWED_ENGAGEMENT_STATES:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Invalid engagement_state: {engagement_state}"
                    })
                    continue

                if confusion_signal not in ALLOWED_CONFUSION_SIGNALS:
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Invalid confusion_signal: {confusion_signal}"
                    })
                    continue

                # 8. Validate confidence range and type
                if isinstance(confidence, bool) or not isinstance(confidence, (int, float)) or confidence < 0.0 or confidence > 1.0:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Confidence must be a number between 0.0 and 1.0"
                    })
                    continue

                # 9. Dispatch authoritative server-enriched telemetry only to teachers in this session
                received_at_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                telemetry_payload = {
                    "type": "student_behaviour_telemetry",
                    "data": {
                        "user_id": user["id"],
                        "student_name": user.get("name", "Student"),
                        "engagement_state": engagement_state,
                        "confusion_signal": confusion_signal,
                        "confidence": float(confidence),
                        "received_at_ms": received_at_ms
                    }
                }
                await manager.send_to_teachers(session_id, telemetry_payload)
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
