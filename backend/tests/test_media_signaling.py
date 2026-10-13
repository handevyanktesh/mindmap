import pytest
from app.services.connection_manager import manager

def get_auth_token_and_user(client, email: str, role: str):
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
    token = resp.json()["access_token"]
    user_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).json()
    return token, user_me


def test_webrtc_signaling_p2p_routing(client):
    """Test targeted WebRTC signaling routing between peers in active session."""
    teacher_token, teacher_user = get_auth_token_and_user(client, "media_sig_t@test.com", "teacher")
    student_token, student_user = get_auth_token_and_user(client, "media_sig_s@test.com", "student")

    # Setup classroom and session
    c_resp = client.post("/api/classrooms/", json={"name": "Signaling 101"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "P2P WebRTC"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_id}/join", headers={"Authorization": f"Bearer {student_token}"})

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={teacher_token}") as ws_teacher:
        init_t = ws_teacher.receive_json()
        assert init_t["type"] == "session_connected"

        with client.websocket_connect(f"/ws/sessions/{s_id}?token={student_token}") as ws_student:
            init_s = ws_student.receive_json()
            assert init_s["type"] == "session_connected"

            # 1. Student sends SDP offer signal to teacher
            ws_student.send_json({
                "type": "webrtc_signal",
                "target_id": teacher_user["id"],
                "signal": {
                    "type": "offer",
                    "sdp": "v=0\r\no=- 461173 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
                }
            })

            # Teacher receives the signal
            recv_signal = ws_teacher.receive_json()
            assert recv_signal["type"] == "webrtc_signal"
            assert recv_signal["sender_id"] == student_user["id"]
            assert recv_signal["sender_role"] == "student"
            assert recv_signal["signal"]["type"] == "offer"
            assert "sdp" in recv_signal["signal"]

            # 2. Teacher replies with SDP answer signal to student
            ws_teacher.send_json({
                "type": "webrtc_signal",
                "target_id": student_user["id"],
                "signal": {
                    "type": "answer",
                    "sdp": "v=0\r\no=- 461174 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n"
                }
            })

            # Student receives the answer
            recv_answer = ws_student.receive_json()
            assert recv_answer["type"] == "webrtc_signal"
            assert recv_answer["sender_id"] == teacher_user["id"]
            assert recv_answer["sender_role"] == "teacher"
            assert recv_answer["signal"]["type"] == "answer"


def test_webrtc_signaling_invalid_target_and_missing_payload(client):
    """Test signaling error states: invalid target, missing target, missing signal payload."""
    teacher_token, teacher_user = get_auth_token_and_user(client, "media_err_t@test.com", "teacher")
    student_token, student_user = get_auth_token_and_user(client, "media_err_s@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "Signaling Err 101"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Error Handling"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_id}/join", headers={"Authorization": f"Bearer {student_token}"})

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={student_token}") as ws_student:
        ws_student.receive_json()

        # Missing target_id
        ws_student.send_json({
            "type": "webrtc_signal",
            "signal": {"type": "offer", "sdp": "v=0"}
        })
        err1 = ws_student.receive_json()
        assert err1["type"] == "error"
        assert "target_id" in err1["message"]

        # Missing signal payload
        ws_student.send_json({
            "type": "webrtc_signal",
            "target_id": "nonexistent_target_user_id"
        })
        err2 = ws_student.receive_json()
        assert err2["type"] == "error"
        assert "signal" in err2["message"]

        # Target peer not available in session
        ws_student.send_json({
            "type": "webrtc_signal",
            "target_id": "unknown_peer_999",
            "signal": {"candidate": "candidate:1 1 UDP 2122260223"}
        })
        err3 = ws_student.receive_json()
        assert err3["type"] == "error"
        assert "not available" in err3["message"]


def test_webrtc_signaling_cross_session_isolation(client):
    """Verify that a user in session 1 cannot signal a peer in session 2."""
    teacher_token, teacher_user = get_auth_token_and_user(client, "media_iso_t@test.com", "teacher")
    student1_token, student1_user = get_auth_token_and_user(client, "media_iso_s1@test.com", "student")
    student2_token, student2_user = get_auth_token_and_user(client, "media_iso_s2@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "Isolation Room"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    # Create Session 1 and Session 2
    s1_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Room 1"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s1_id = s1_resp.json()["id"]

    s2_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Room 2"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s2_id = s2_resp.json()["id"]

    client.post(f"/api/sessions/{s1_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s2_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})

    client.post(f"/api/sessions/{s1_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    client.post(f"/api/sessions/{s2_id}/join", headers={"Authorization": f"Bearer {student2_token}"})

    # Student 1 in Room 1, Student 2 in Room 2
    with client.websocket_connect(f"/ws/sessions/{s1_id}?token={student1_token}") as ws_s1:
        ws_s1.receive_json()
        with client.websocket_connect(f"/ws/sessions/{s2_id}?token={student2_token}") as ws_s2:
            ws_s2.receive_json()

            # Student 1 attempts to signal Student 2 across room boundaries
            ws_s1.send_json({
                "type": "webrtc_signal",
                "target_id": student2_user["id"],
                "signal": {"type": "offer", "sdp": "cross-room-leak"}
            })

            # Student 1 should receive error because Student 2 is not in Room 1
            err = ws_s1.receive_json()
            assert err["type"] == "error"
            assert "not available in this session" in err["message"]


def test_screenshare_role_authorization_and_broadcasting(client):
    """Verify that only teachers can broadcast screenshare start/stop, and students are denied."""
    teacher_token, teacher_user = get_auth_token_and_user(client, "media_scr_t@test.com", "teacher")
    student_token, student_user = get_auth_token_and_user(client, "media_scr_s@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "Screenshare Class"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Screenshare Test"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_id}/join", headers={"Authorization": f"Bearer {student_token}"})

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={teacher_token}") as ws_t:
        ws_t.receive_json()
        with client.websocket_connect(f"/ws/sessions/{s_id}?token={student_token}") as ws_s:
            ws_s.receive_json()

            # 1. Student attempts screenshare_started -> denied with error
            ws_s.send_json({"type": "screenshare_started"})
            err1 = ws_s.receive_json()
            assert err1["type"] == "error"
            assert "Only teachers are permitted" in err1["message"]

            # 2. Student attempts screenshare_stopped -> denied with error
            ws_s.send_json({"type": "screenshare_stopped"})
            err2 = ws_s.receive_json()
            assert err2["type"] == "error"
            assert "Only teachers are permitted" in err2["message"]

            # 3. Teacher initiates screenshare_started -> student receives broadcast
            ws_t.send_json({"type": "screenshare_started"})
            scr_start_msg = ws_s.receive_json()
            assert scr_start_msg["type"] == "screenshare_started"
            assert scr_start_msg["data"]["teacher_id"] == teacher_user["id"]

            # 4. Teacher stops screenshare -> student receives broadcast
            ws_t.send_json({"type": "screenshare_stopped"})
            scr_stop_msg = ws_s.receive_json()
            assert scr_stop_msg["type"] == "screenshare_stopped"
            assert scr_stop_msg["data"]["teacher_id"] == teacher_user["id"]


def test_voice_presence_and_status_broadcasting(client):
    """Verify voice_join, voice_leave, voice_status broadcasts among room participants."""
    teacher_token, teacher_user = get_auth_token_and_user(client, "media_voc_t@test.com", "teacher")
    student_token, student_user = get_auth_token_and_user(client, "media_voc_s@test.com", "student")

    c_resp = client.post("/api/classrooms/", json={"name": "Voice Presence Class"}, headers={"Authorization": f"Bearer {teacher_token}"})
    c_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={"classroom_id": c_id, "title": "Voice Room"}, headers={"Authorization": f"Bearer {teacher_token}"})
    s_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{s_id}/start", headers={"Authorization": f"Bearer {teacher_token}"})
    client.post(f"/api/sessions/{s_id}/join", headers={"Authorization": f"Bearer {student_token}"})

    with client.websocket_connect(f"/ws/sessions/{s_id}?token={teacher_token}") as ws_t:
        ws_t.receive_json()
        with client.websocket_connect(f"/ws/sessions/{s_id}?token={student_token}") as ws_s:
            ws_s.receive_json()

            # 1. Student joins voice -> teacher receives voice_peer_joined
            ws_s.send_json({"type": "voice_join"})
            v_join = ws_t.receive_json()
            assert v_join["type"] == "voice_peer_joined"
            assert v_join["data"]["user_id"] == student_user["id"]
            assert v_join["data"]["role"] == "student"

            # 2. Student updates voice speaking status -> teacher receives voice_status
            ws_s.send_json({
                "type": "voice_status",
                "payload": {
                    "is_muted": False,
                    "is_speaking": True
                }
            })
            v_stat = ws_t.receive_json()
            assert v_stat["type"] == "voice_status"
            assert v_stat["data"]["user_id"] == student_user["id"]
            assert v_stat["data"]["is_muted"] is False
            assert v_stat["data"]["is_speaking"] is True

            # 3. Student requests peer list
            ws_s.send_json({"type": "get_peers"})
            peers_msg = ws_s.receive_json()
            assert peers_msg["type"] == "peer_list"
            # Teacher should be listed
            peer_ids = [p["user_id"] for p in peers_msg["peers"]]
            assert teacher_user["id"] in peer_ids

            # 4. Student leaves voice -> teacher receives voice_peer_left
            ws_s.send_json({"type": "voice_leave"})
            v_leave = ws_t.receive_json()
            assert v_leave["type"] == "voice_peer_left"
            assert v_leave["data"]["user_id"] == student_user["id"]
