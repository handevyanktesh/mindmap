import pytest

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

def test_authorization_checks(client):
    teacher_token = get_auth_token(client, "t_auth_part@test.com", "teacher")
    student_token = get_auth_token(client, "s_auth_part@test.com", "student")

    # 1. Unauthenticated user cannot join.
    r1 = client.post("/api/sessions/some-session/join")
    assert r1.status_code == 401

    # 2. Teacher cannot join as student.
    r2 = client.post("/api/sessions/some-session/join", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r2.status_code == 403

    # 3. Unauthenticated user cannot leave.
    r3 = client.post("/api/sessions/some-session/leave")
    assert r3.status_code == 401

    # 4. Teacher cannot leave as student.
    r4 = client.post("/api/sessions/some-session/leave", headers={"Authorization": f"Bearer {teacher_token}"})
    assert r4.status_code == 403

    # 5. Unauthenticated user cannot list participants.
    r5 = client.get("/api/sessions/some-session/participants")
    assert r5.status_code == 401

    # 6. Student cannot list all session participants.
    r6 = client.get("/api/sessions/some-session/participants", headers={"Authorization": f"Bearer {student_token}"})
    assert r6.status_code == 403

def test_participant_join_leave_and_integrity(client):
    teacher1_token = get_auth_token(client, "t1_part@test.com", "teacher")
    teacher2_token = get_auth_token(client, "t2_part@test.com", "teacher")
    student1_token = get_auth_token(client, "s1_part@test.com", "student")
    student2_token = get_auth_token(client, "s2_part@test.com", "student")

    # Teacher 1 creates classroom
    c_resp = client.post("/api/classrooms/", json={
        "name": "Operating Systems",
        "description": "Kernel architecture"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert c_resp.status_code == 200
    classroom_id = c_resp.json()["id"]

    # Teacher 1 creates scheduled session
    s_resp = client.post("/api/sessions/", json={
        "classroom_id": classroom_id,
        "title": "Processes and Threads"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert s_resp.status_code == 200
    session_id = s_resp.json()["id"]

    # 8. Student cannot join scheduled session.
    join_scheduled = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert join_scheduled.status_code == 400
    assert "scheduled" in join_scheduled.json()["detail"].lower()

    # 10. Student cannot join nonexistent session.
    join_nonexistent = client.post("/api/sessions/nonexistent-session-id/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert join_nonexistent.status_code == 404

    # 16. Student cannot leave if they never joined.
    leave_never_joined = client.post(f"/api/sessions/{session_id}/leave", headers={"Authorization": f"Bearer {student1_token}"})
    assert leave_never_joined.status_code in [400, 404]

    # Teacher 1 starts session
    start_resp = client.post(f"/api/sessions/{session_id}/start", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert start_resp.status_code == 200
    assert start_resp.json()["status"] == "active"

    # 7. Student can join an active session.
    # 22. participant.student_id comes from JWT.
    # 23. participant.classroom_id comes from session.
    # 24. participant.session_id matches the URL session.
    # 25. joined_at is generated server-side.
    join_resp = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert join_resp.status_code == 200
    p1 = join_resp.json()
    assert p1["session_id"] == session_id
    assert p1["classroom_id"] == classroom_id
    assert p1["status"] == "joined"
    assert p1["joined_at"] is not None
    assert p1["left_at"] is None
    p1_id = p1["id"]

    # 11. Student cannot join another teacher's session unless it is active (any student can join any active session)
    join_s2_resp = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student2_token}"})
    assert join_s2_resp.status_code == 200
    assert join_s2_resp.json()["status"] == "joined"

    # 12. Same student cannot create duplicate active participation.
    dup_join = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert dup_join.status_code == 400
    assert "already" in dup_join.json()["detail"].lower()

    # 18. Student can retrieve their own participation.
    part_resp = client.get(f"/api/sessions/{session_id}/participation", headers={"Authorization": f"Bearer {student1_token}"})
    assert part_resp.status_code == 200
    assert part_resp.json()["id"] == p1_id
    assert part_resp.json()["status"] == "joined"

    # 19. Student cannot retrieve another student's participation.
    # When student 2 requests participation, they receive their own, NOT student 1's.
    s2_part_resp = client.get(f"/api/sessions/{session_id}/participation", headers={"Authorization": f"Bearer {student2_token}"})
    assert s2_part_resp.status_code == 200
    assert s2_part_resp.json()["id"] != p1_id

    # 20. Session owner can list participants.
    # 27. password_hash is never exposed.
    t1_list_resp = client.get(f"/api/sessions/{session_id}/participants", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert t1_list_resp.status_code == 200
    participants_list = t1_list_resp.json()
    assert len(participants_list) == 2
    for p in participants_list:
        assert "password_hash" not in p
        assert "password" not in p
        assert p["student_name"] is not None
        assert p["student_email"] is not None

    # 21. Teacher cannot list participants of another teacher's session.
    t2_list_resp = client.get(f"/api/sessions/{session_id}/participants", headers={"Authorization": f"Bearer {teacher2_token}"})
    assert t2_list_resp.status_code == 403

    # 13, 15, 26. Student can leave an active participation (left_at populated server-side).
    leave_resp = client.post(f"/api/sessions/{session_id}/leave", headers={"Authorization": f"Bearer {student1_token}"})
    assert leave_resp.status_code == 200
    left_p = leave_resp.json()
    assert left_p["status"] == "left"
    assert left_p["left_at"] is not None

    # 17. Student cannot leave the same participation twice.
    leave_again = client.post(f"/api/sessions/{session_id}/leave", headers={"Authorization": f"Bearer {student1_token}"})
    assert leave_again.status_code == 400
    assert "already left" in leave_again.json()["detail"].lower()

    # 14. Student can rejoin after leaving.
    rejoin_resp = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert rejoin_resp.status_code == 200
    rejoined_p = rejoin_resp.json()
    assert rejoined_p["status"] == "joined"
    assert rejoined_p["id"] != p1_id # New participant record

    # F-03: Roster deduplication check: Student 1 appears exactly once as "joined"
    t1_list_after_rejoin = client.get(f"/api/sessions/{session_id}/participants", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert t1_list_after_rejoin.status_code == 200
    rejoined_list = t1_list_after_rejoin.json()
    assert len(rejoined_list) == 2 # Exactly 2 logical students, not 3
    s1_entries = [p for p in rejoined_list if p["student_email"] == "s1_part@test.com"]
    assert len(s1_entries) == 1
    assert s1_entries[0]["status"] == "joined"

    # Repeated join while active is rejected
    dup_rejoin = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student1_token}"})
    assert dup_rejoin.status_code == 400
    assert "already" in dup_rejoin.json()["detail"].lower()

    # Student 1 leaves again -> verify status updates to "left" without creating duplicate row
    leave2_resp = client.post(f"/api/sessions/{session_id}/leave", headers={"Authorization": f"Bearer {student1_token}"})
    assert leave2_resp.status_code == 200
    t1_list_after_leave2 = client.get(f"/api/sessions/{session_id}/participants", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert t1_list_after_leave2.status_code == 200
    leave2_list = t1_list_after_leave2.json()
    assert len(leave2_list) == 2
    s1_entries_leave2 = [p for p in leave2_list if p["student_email"] == "s1_part@test.com"]
    assert len(s1_entries_leave2) == 1
    assert s1_entries_leave2[0]["status"] == "left"

    # Teacher ends session
    client.post(f"/api/sessions/{session_id}/end", headers={"Authorization": f"Bearer {teacher1_token}"})

    # 9. Student cannot join ended session.
    student3_token = get_auth_token(client, "s3_part@test.com", "student")
    join_ended = client.post(f"/api/sessions/{session_id}/join", headers={"Authorization": f"Bearer {student3_token}"})
    assert join_ended.status_code == 400
    assert "ended" in join_ended.json()["detail"].lower()
