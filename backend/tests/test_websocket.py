import asyncio
import pytest
from starlette.websockets import WebSocketDisconnect
from app.services.connection_manager import manager

def get_auth_token(client, email, role):
    client.post("/api/auth/register", json={
        "name": f"User {email}",
        "email": email,
        "password": "securepassword123",
        "role": role
    })
    resp = client.post("/api/auth/login", json={
        "email": email,
        "password": "securepassword123"
    })
    return resp.json()["access_token"]

def test_websocket_authorization_and_lifecycle(client):
    teacher1_token = get_auth_token(client, "ws_teacher1@test.com", "teacher")
    teacher2_token = get_auth_token(client, "ws_teacher2@test.com", "teacher")
    student1_token = get_auth_token(client, "ws_student1@test.com", "student")
    student2_token = get_auth_token(client, "ws_student2@test.com", "student")

    # 1. Unauthenticated WebSocket connection rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws/sessions/any-session-id"):
            pass
    assert exc.value.code == 1008

    # 2. Invalid JWT rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect("/ws/sessions/any-session-id?token=invalid.jwt.token"):
            pass
    assert exc.value.code == 1008

    # Teacher 1 creates classroom
    c_resp = client.post("/api/classrooms/", json={
        "name": "Distributed Systems",
        "description": "Realtime WebSockets"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert c_resp.status_code == 200
    classroom_id = c_resp.json()["id"]

    # Teacher 1 creates scheduled session
    s_resp = client.post("/api/sessions/", json={
        "classroom_id": classroom_id,
        "title": "WebSocket Architecture"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert s_resp.status_code == 200
    session_id = s_resp.json()["id"]

    # 3. Nonexistent session rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/sessions/nonexistent-session-id?token={teacher1_token}"):
            pass
    assert exc.value.code == 1008

    # 4. Scheduled session rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/sessions/{session_id}?token={teacher1_token}"):
            pass
    assert exc.value.code == 1008

    # Teacher 1 starts session (now active)
    start_resp = client.post(f"/api/sessions/{session_id}/start", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert start_resp.status_code == 200

    # 6. Student who is not an active participant rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/sessions/{session_id}?token={student1_token}"):
            pass
    assert exc.value.code == 1008

    # 9. Teacher who does not own the classroom rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/sessions/{session_id}?token={teacher2_token}"):
            pass
    assert exc.value.code == 1008

    # 8. Teacher who owns the classroom accepted.
    with client.websocket_connect(f"/ws/sessions/{session_id}?token={teacher1_token}") as ws_teacher:
        msg = ws_teacher.receive_json()
        assert msg["type"] == "session_connected"
        assert msg["session_id"] == session_id
        assert msg["role"] == "teacher"

        # 10. Ping returns pong.
        ws_teacher.send_json({"type": "ping"})
        pong = ws_teacher.receive_json()
        assert pong["type"] == "pong"

    # Student 1 joins session as active participant
    join_resp = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert join_resp.status_code == 200

    # 7. Active student participant accepted.
    # 11. Disconnect removes the connection.
    assert manager.get_connection_count(session_id) == 0
    with client.websocket_connect(f"/ws/sessions/{session_id}?token={student1_token}") as ws_student:
        msg = ws_student.receive_json()
        assert msg["type"] == "session_connected"
        assert msg["session_id"] == session_id
        assert msg["role"] == "student"
        assert manager.get_connection_count(session_id) == 1

        # Test malformed JSON does not crash connection
        ws_student.send_text("not a json string")
        err_msg = ws_student.receive_json()
        assert err_msg["type"] == "error"

        # Ping returns pong
        ws_student.send_json({"type": "ping"})
        pong = ws_student.receive_json()
        assert pong["type"] == "pong"

    # After exiting context manager, connection is removed
    assert manager.get_connection_count(session_id) == 0

    # Teacher 1 ends the session
    end_resp = client.post(f"/api/sessions/{session_id}/end", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert end_resp.status_code == 200

    # 5. Ended session rejected.
    with pytest.raises(WebSocketDisconnect) as exc:
        with client.websocket_connect(f"/ws/sessions/{session_id}?token={student1_token}"):
            pass
    assert exc.value.code == 1008

def test_websocket_session_isolation(client):
    teacher_token = get_auth_token(client, "ws_iso_teacher@test.com", "teacher")
    student1_token = get_auth_token(client, "ws_iso_s1@test.com", "student")
    student2_token = get_auth_token(client, "ws_iso_s2@test.com", "student")

    # Create classroom
    c_resp = client.post("/api/classrooms/", json={"name": "Classroom Isolation"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    # Create Session A & Session B
    s_a = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Session A"}, headers={"Authorization": f"Bearer {teacher_token}"}).json()["id"]
    s_b = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Session B"}, headers={"Authorization": f"Bearer {teacher_token}"}).json()["id"]

    # Start both sessions
    client.post(f"/api/sessions/{s_a}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_b}/start", headers={"Authorization": f"Bearer {teacher_token}"})

    # Student 1 joins Session A, Student 2 joins Session B
    client.post(f"/api/sessions/{s_a}/join", headers={"Authorization": f"Bearer {student1_token}"})
    client.post(f"/api/sessions/{s_b}/join", headers={"Authorization": f"Bearer {student2_token}"})

    # 12. Connections are isolated by session_id.
    with client.websocket_connect(f"/ws/sessions/{s_a}?token={student1_token}") as ws_a:
        with client.websocket_connect(f"/ws/sessions/{s_b}?token={student2_token}") as ws_b:
            # Both received connection messages
            assert ws_a.receive_json()["session_id"] == s_a
            assert ws_b.receive_json()["session_id"] == s_b

            assert manager.get_connection_count(s_a) == 1
            assert manager.get_connection_count(s_b) == 1

            # Broadcast to Session A only
            asyncio.run(manager.broadcast_to_session(s_a, {"type": "room_a_event", "data": "hello A"}))

            # ws_a receives the event
            event_a = ws_a.receive_json()
            assert event_a["type"] == "room_a_event"
            assert event_a["data"] == "hello A"

            # ws_b does NOT receive room_a_event (ping test to confirm queue is clean)
            ws_b.send_json({"type": "ping"})
            resp_b = ws_b.receive_json()
            assert resp_b["type"] == "pong"


def test_phase3c_behavioural_telemetry(client):
    """
    Validates Phase 3C WebSocket behavioural telemetry specifications (T1 to T15).
    """
    teacher_token = get_auth_token(client, "t_telemetry@test.com", "teacher")
    student1_token = get_auth_token(client, "s1_telemetry@test.com", "student")
    student2_token = get_auth_token(client, "s2_telemetry@test.com", "student")
    teacher2_token = get_auth_token(client, "t2_telemetry@test.com", "teacher")

    # Setup classroom and sessions
    c1_id = client.post("/api/classrooms/", json={"name": "Class 1"}, headers={"Authorization": f"Bearer {teacher_token}"}).json()["id"]
    c2_id = client.post("/api/classrooms/", json={"name": "Class 2"}, headers={"Authorization": f"Bearer {teacher2_token}"}).json()["id"]

    s1_id = client.post("/api/sessions/", json={"classroom_id": c1_id, "title": "Session 1"}, headers={"Authorization": f"Bearer {teacher_token}"}).json()["id"]
    s2_id = client.post("/api/sessions/", json={"classroom_id": c2_id, "title": "Session 2"}, headers={"Authorization": f"Bearer {teacher2_token}"}).json()["id"]

    # Start both sessions
    client.post(f"/api/sessions/{s1_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s2_id}/start", headers={"Authorization": f"Bearer {teacher2_token}"})

    # Student 1 & 2 join Session 1
    client.post(f"/api/sessions/{s1_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    client.post(f"/api/sessions/{s1_id}/join", headers={"Authorization": f"Bearer {student2_token}"})

    # Connect Teacher 1, Student 1, Student 2 to Session 1, and Teacher 2 to Session 2
    with client.websocket_connect(f"/ws/sessions/{s1_id}?token={teacher_token}") as ws_teacher1:
        with client.websocket_connect(f"/ws/sessions/{s1_id}?token={student1_token}") as ws_student1:
            with client.websocket_connect(f"/ws/sessions/{s1_id}?token={student2_token}") as ws_student2:
                with client.websocket_connect(f"/ws/sessions/{s2_id}?token={teacher2_token}") as ws_teacher2:
                    # Flush connection greetings
                    assert ws_teacher1.receive_json()["type"] == "session_connected"
                    assert ws_student1.receive_json()["type"] == "session_connected"
                    assert ws_student2.receive_json()["type"] == "session_connected"
                    assert ws_teacher2.receive_json()["type"] == "session_connected"

                    # T2: Teacher cannot send student_behaviour_update
                    ws_teacher1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": 0.8
                        }
                    })
                    err = ws_teacher1.receive_json()
                    assert err["type"] == "error"
                    assert "Only students" in err["message"]

                    # T5: Missing engagement_state rejected
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "confusion_signal": "LOW",
                            "confidence": 0.8
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "Missing required fields" in err["message"]

                    # T6: Missing confusion_signal rejected
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confidence": 0.8
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "Missing required fields" in err["message"]

                    # T7: Invalid engagement state rejected
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "ATTENTIVE",
                            "confusion_signal": "LOW",
                            "confidence": 0.8
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "Invalid engagement_state" in err["message"]

                    # T8: Invalid confusion signal rejected
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "VERY_CONFUSED",
                            "confidence": 0.8
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "Invalid confusion_signal" in err["message"]

                    # T9: Confidence outside [0,1] or non-numeric rejected
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": 1.5
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "Confidence" in err["message"]

                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": "high"
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"

                    # T10: Extra biometric fields rejected (Privacy guardrail)
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": 0.85,
                            "landmarks": [1, 2, 3]
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "extra biometric fields" in err["message"]

                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": 0.85,
                            "ear": 0.35
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "extra biometric fields" in err["message"]

                    # Extra unexpected non-biometric fields rejected (Strict payload check)
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": 0.85,
                            "timestamp_ms": 1728362400000
                        }
                    })
                    err = ws_student1.receive_json()
                    assert err["type"] == "error"
                    assert "unexpected fields" in err["message"]

                    # T1 / T11 / T14: Student sends valid update -> Reaches teacher with authoritative server timestamp & injected identity
                    ws_student1.send_json({
                        "type": "student_behaviour_update",
                        "payload": {
                            "engagement_state": "NORMAL_BEHAVIOUR",
                            "confusion_signal": "LOW",
                            "confidence": 0.92
                        }
                    })

                    # Teacher 1 receives enriched telemetry with data dictionary
                    msg = ws_teacher1.receive_json()
                    assert msg["type"] == "student_behaviour_telemetry"
                    assert "data" in msg
                    data = msg["data"]
                    assert data["user_id"] == "user_student1_id" or len(data["user_id"]) > 0
                    assert data["student_name"] == "User s1_telemetry@test.com"
                    assert "student_email" not in data
                    assert data["engagement_state"] == "NORMAL_BEHAVIOUR"
                    assert data["confusion_signal"] == "LOW"
                    assert data["confidence"] == 0.92
                    assert "received_at_ms" in data
                    assert isinstance(data["received_at_ms"], int)

                    # T12: Student 2 does NOT receive Student 1's telemetry (Peer privacy)
                    ws_student2.send_json({"type": "ping"})
                    pong2 = ws_student2.receive_json()
                    assert pong2["type"] == "pong"

                    # Student 1 does NOT receive its own telemetry back
                    ws_student1.send_json({"type": "ping"})
                    pong1 = ws_student1.receive_json()
                    assert pong1["type"] == "pong"

                    # T13: Teacher in Session 2 does NOT receive Session 1 telemetry (Session isolation)
                    ws_teacher2.send_json({"type": "ping"})
                    pong_t2 = ws_teacher2.receive_json()
                    assert pong_t2["type"] == "pong"

                    # F-02: Ending session notifies connected clients with session_ended
                    end_resp = client.post(f"/api/sessions/{s1_id}/end", headers={"Authorization": f"Bearer {teacher_token}"})
                    assert end_resp.status_code == 200

                    # Connected students in session 1 receive session_ended event
                    student1_event = ws_student1.receive_json()
                    assert student1_event["type"] == "session_ended"
                    assert student1_event["session_id"] == s1_id

                    student2_event = ws_student2.receive_json()
                    assert student2_event["type"] == "session_ended"
                    assert student2_event["session_id"] == s1_id

                    # Teacher in Session 2 did NOT receive session_ended for Session 1 (Session isolation)
                    ws_teacher2.send_json({"type": "ping"})
                    pong_t2_post = ws_teacher2.receive_json()
                    assert pong_t2_post["type"] == "pong"

    # T15: Clean disconnect
    assert manager.get_connection_count(s1_id) == 0
    assert manager.get_connection_count(s2_id) == 0

