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
