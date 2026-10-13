import pytest
from app.services.connection_manager import manager

def get_auth_token(client, email: str, role: str) -> str:
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


def test_chat_authorization_and_cross_classroom_denial(client):
    """Test REST endpoint authorization and cross-classroom access denial."""
    teacher1_token = get_auth_token(client, "chat_teach1@test.com", "teacher")
    teacher2_token = get_auth_token(client, "chat_teach2@test.com", "teacher")
    student1_token = get_auth_token(client, "chat_stu1@test.com", "student")
    student2_token = get_auth_token(client, "chat_stu2@test.com", "student")

    # Teacher 1 creates classroom & session
    c1_resp = client.post("/api/classrooms/", json={
        "name": "Chemistry 101",
        "description": "Organic Chemistry"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert c1_resp.status_code == 200
    c1_id = c1_resp.json()["id"]

    s1_resp = client.post("/api/sessions/", json={
        "classroom_id": c1_id,
        "title": "Alkanes & Alkenes"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert s1_resp.status_code == 200
    s1_id = s1_resp.json()["id"]

    # Start session
    client.post(f"/api/sessions/{s1_id}/start", headers={"Authorization": f"Bearer {teacher1_token}"})

    # Student 1 joins session
    client.post(f"/api/sessions/{s1_id}/join", headers={"Authorization": f"Bearer {student1_token}"})

    # 1. Unauthenticated user denied
    res_unauth = client.get(f"/api/sessions/{s1_id}/chat")
    assert res_unauth.status_code == 401

    # 2. Teacher 2 (not owner of classroom) denied
    res_t2 = client.get(f"/api/sessions/{s1_id}/chat", headers={"Authorization": f"Bearer {teacher2_token}"})
    assert res_t2.status_code == 403

    # 3. Student 2 (not participant) denied
    res_s2 = client.get(f"/api/sessions/{s1_id}/chat", headers={"Authorization": f"Bearer {student2_token}"})
    assert res_s2.status_code == 403

    # 4. Teacher 1 (owner) authorized
    res_t1 = client.get(f"/api/sessions/{s1_id}/chat", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert res_t1.status_code == 200
    assert isinstance(res_t1.json(), list)

    # 5. Student 1 (joined participant) authorized
    res_s1 = client.get(f"/api/sessions/{s1_id}/chat", headers={"Authorization": f"Bearer {student1_token}"})
    assert res_s1.status_code == 200
    assert isinstance(res_s1.json(), list)


def test_chat_message_validation(client):
    """Test validation of chat messages over WebSocket: length boundaries, empty text, malformed payloads."""
    teacher_token = get_auth_token(client, "chat_val_teach@test.com", "teacher")
    student_token = get_auth_token(client, "chat_val_stu@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "Biology 101"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Cell Mitosis"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_id}/join", headers={"Authorization": f"Bearer {student_token}"})

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={student_token}") as ws:
        connected = ws.receive_json()
        assert connected["type"] == "session_connected"

        # 1. Empty message text
        ws.send_json({"type": "chat_message", "content": ""})
        err = ws.receive_json()
        assert err["type"] == "error"
        assert "between 1 and 500" in err["message"]

        # 2. Whitespace only message
        ws.send_json({"type": "chat_message", "content": "    "})
        err = ws.receive_json()
        assert err["type"] == "error"
        assert "between 1 and 500" in err["message"]

        # 3. Oversized message (> 500 chars)
        ws.send_json({"type": "chat_message", "content": "x" * 501})
        err = ws.receive_json()
        assert err["type"] == "error"
        assert "between 1 and 500" in err["message"]

        # 4. Missing content / non-string
        ws.send_json({"type": "chat_message", "content": 12345})
        err = ws.receive_json()
        assert err["type"] == "error"
        assert "Missing or invalid" in err["message"]


def test_realtime_chat_broadcast_and_isolation(client):
    """Test bidirectional chat delivery, role attribution, and cross-session isolation."""
    teacher_token = get_auth_token(client, "chat_iso_teach@test.com", "teacher")
    s1_token = get_auth_token(client, "chat_iso_s1@test.com", "student")
    s2_token = get_auth_token(client, "chat_iso_s2@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "History 101"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    # Session A
    s_a = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Ancient Rome"}, headers={"Authorization": f"Bearer {teacher_token}"}).json()["id"]
    client.post(f"/api/sessions/{s_a}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_a}/join", headers={"Authorization": f"Bearer {s1_token}"})

    # Session B
    s_b = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Ancient Greece"}, headers={"Authorization": f"Bearer {teacher_token}"}).json()["id"]
    client.post(f"/api/sessions/{s_b}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_b}/join", headers={"Authorization": f"Bearer {s2_token}"})

    # Connect Teacher & Student 1 to Session A; Student 2 to Session B
    with client.websocket_connect(f"/ws/sessions/{s_a}?token={teacher_token}") as ws_teacher_a, \
         client.websocket_connect(f"/ws/sessions/{s_a}?token={s1_token}") as ws_s1_a, \
         client.websocket_connect(f"/ws/sessions/{s_b}?token={s2_token}") as ws_s2_b:

        # Consume initial handshake
        assert ws_teacher_a.receive_json()["type"] == "session_connected"
        assert ws_s1_a.receive_json()["type"] == "session_connected"
        assert ws_s2_b.receive_json()["type"] == "session_connected"

        # 1. Student 1 sends a message in Session A
        # Attempt to spoof sender name and role
        ws_s1_a.send_json({
            "type": "chat_message",
            "content": "Can you explain the Roman Senate?",
            "sender_name": "Hacked Professor",
            "sender_role": "teacher"
        })

        # Teacher in Session A receives the broadcast
        msg_teacher = ws_teacher_a.receive_json()
        assert msg_teacher["type"] == "chat_message"
        data_t = msg_teacher["data"]
        assert data_t["content"] == "Can you explain the Roman Senate?"
        assert data_t["sender_role"] == "student"  # Server-authoritative, spoofing failed!
        assert data_t["session_id"] == s_a
        assert "id" in data_t
        assert "created_at" in data_t

        # Student 1 in Session A also receives the broadcast
        msg_s1 = ws_s1_a.receive_json()
        assert msg_s1["type"] == "chat_message"
        assert msg_s1["data"]["id"] == data_t["id"]

        # 2. Teacher replies in Session A
        ws_teacher_a.send_json({
            "type": "chat_message",
            "content": "The Senate was the council of elders in Rome."
        })

        reply_s1 = ws_s1_a.receive_json()
        assert reply_s1["type"] == "chat_message"
        assert reply_s1["data"]["sender_role"] == "teacher"
        assert reply_s1["data"]["content"] == "The Senate was the council of elders in Rome."

        reply_t = ws_teacher_a.receive_json()
        assert reply_t["type"] == "chat_message"
        assert reply_t["data"]["id"] == reply_s1["data"]["id"]

        # 3. Verify Session B did NOT receive Session A's messages (isolation)
        # Send a ping on Session B to ensure socket is alive and receives only pong
        ws_s2_b.send_json({"type": "ping"})
        pong_b = ws_s2_b.receive_json()
        assert pong_b["type"] == "pong"


def test_chat_persistence_and_privacy_invariants(client, test_db):
    """Test message persistence in MongoDB, retrieval via REST, and strict privacy invariants."""
    teacher_token = get_auth_token(client, "chat_priv_teach@test.com", "teacher")
    s1_token = get_auth_token(client, "chat_priv_s1@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "CS 301"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Data Structures"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_id}/join", headers={"Authorization": f"Bearer {s1_token}"})

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={s1_token}") as ws:
        assert ws.receive_json()["type"] == "session_connected"
        ws.send_json({"type": "chat_message", "content": "What is the time complexity of lookup in hash tables?"})
        recv = ws.receive_json()
        assert recv["type"] == "chat_message"

    # Fetch history via REST
    hist_resp = client.get(f"/api/sessions/{s_id}/chat", headers={"Authorization": f"Bearer {s1_token}"})
    assert hist_resp.status_code == 200
    messages = hist_resp.json()
    assert len(messages) >= 1
    m = messages[0]
    assert m["content"] == "What is the time complexity of lookup in hash tables?"
    assert m["sender_role"] == "student"

    # Privacy Invariants: inspect raw database document
    raw_doc = test_db.chat_messages.find_one({"_id": m["id"]})
    assert raw_doc is not None
    # Verify NO biometric or telemetry fields are present
    forbidden_keys = {"landmarks", "landmark", "ear", "gaze", "pose", "attention_score", "engagement_state", "confusion_signal"}
    assert not any(k in raw_doc for k in forbidden_keys)


def test_disconnect_and_reconnect_cleanup(client):
    """Test connection counter increments and decrements cleanly upon disconnect."""
    teacher_token = get_auth_token(client, "chat_conn_teach@test.com", "teacher")
    c_resp = client.post("/api/classrooms/", json={"name": "Network 101"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]
    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Socket Protocols"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]
    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})

    assert manager.get_connection_count(s_id) == 0

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={teacher_token}") as ws1:
        assert ws1.receive_json()["type"] == "session_connected"
        assert manager.get_connection_count(s_id) == 1

    # After exit, connection is removed
    assert manager.get_connection_count(s_id) == 0

    # Reconnect
    with client.websocket_connect(f"/ws/sessions/{s_id}?token={teacher_token}") as ws2:
        assert ws2.receive_json()["type"] == "session_connected"
        assert manager.get_connection_count(s_id) == 1

    assert manager.get_connection_count(s_id) == 0
