import pytest

def get_auth_token(client, email, role):
    # Register and login helper
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

def test_unauthenticated_cannot_create_session(client):
    # 1. Unauthenticated user cannot create session.
    resp = client.post("/api/sessions/", json={
        "classroom_id": "any-id",
        "title": "Unauth session"
    })
    assert resp.status_code == 401

def test_student_cannot_create_session(client):
    # 2. Student cannot create session.
    student_token = get_auth_token(client, "student_sess@test.com", "student")
    resp = client.post("/api/sessions/", json={
        "classroom_id": "any-id",
        "title": "Student session"
    }, headers={"Authorization": f"Bearer {student_token}"})
    assert resp.status_code == 403

def test_session_lifecycle_and_ownership(client):
    teacher1_token = get_auth_token(client, "teacher1_sess@test.com", "teacher")
    teacher2_token = get_auth_token(client, "teacher2_sess@test.com", "teacher")

    # Setup classroom for Teacher 1
    c1_resp = client.post("/api/classrooms/", json={
        "name": "Math 101",
        "description": "Calculus"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert c1_resp.status_code == 200
    c1_id = c1_resp.json()["id"]

    # 3. Teacher can create session in their own classroom.
    # 18. Backend-controlled fields cannot be supplied to manipulate ownership/status.
    # 19. started_at is populated only when session starts.
    # 20. ended_at is populated only when session ends.
    s1_resp = client.post("/api/sessions/", json={
        "classroom_id": c1_id,
        "title": "Derivatives Lecture",
        "description": "Introduction to derivatives",
        "scheduled_at": "2026-10-01T10:00:00Z",
        # Attempt to inject backend-controlled fields
        "status": "active",
        "teacher_id": "hacker-teacher",
        "started_at": "2026-09-01T10:00:00Z",
        "ended_at": "2026-09-01T12:00:00Z"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert s1_resp.status_code == 200
    s1 = s1_resp.json()
    assert s1["title"] == "Derivatives Lecture"
    assert s1["classroom_id"] == c1_id
    assert s1["status"] == "scheduled" # Injected 'active' status ignored
    assert s1["started_at"] is None     # Injected started_at ignored
    assert s1["ended_at"] is None       # Injected ended_at ignored
    assert s1["teacher_id"] != "hacker-teacher" # Injected teacher_id ignored
    s1_id = s1["id"]

    # 4. Teacher cannot create session in another teacher's classroom.
    s_unauth_resp = client.post("/api/sessions/", json={
        "classroom_id": c1_id,
        "title": "Hacked Session"
    }, headers={"Authorization": f"Bearer {teacher2_token}"})
    assert s_unauth_resp.status_code == 403

    # 5. Cannot create session for nonexistent classroom.
    s_nonexistent_resp = client.post("/api/sessions/", json={
        "classroom_id": "nonexistent-class-id",
        "title": "Ghost Session"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert s_nonexistent_resp.status_code == 404

    # 6. Cannot create session for inactive classroom.
    # Create and deactivate classroom
    c_inactive_resp = client.post("/api/classrooms/", json={
        "name": "Inactive Room"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    c_inactive_id = c_inactive_resp.json()["id"]
    del_resp = client.delete(f"/api/classrooms/{c_inactive_id}", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert del_resp.status_code == 200
    assert del_resp.json()["is_active"] is False

    s_inactive_resp = client.post("/api/sessions/", json={
        "classroom_id": c_inactive_id,
        "title": "Session in Inactive Room"
    }, headers={"Authorization": f"Bearer {teacher1_token}"})
    assert s_inactive_resp.status_code == 400
    assert "inactive" in s_inactive_resp.json()["detail"].lower()

    # 7. Teacher can retrieve own session.
    get_s1_resp = client.get(f"/api/sessions/{s1_id}", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert get_s1_resp.status_code == 200
    assert get_s1_resp.json()["id"] == s1_id

    # 8. Teacher cannot retrieve another teacher's session.
    get_s1_t2_resp = client.get(f"/api/sessions/{s1_id}", headers={"Authorization": f"Bearer {teacher2_token}"})
    assert get_s1_t2_resp.status_code == 403

    # 9. Teacher can list sessions for own classroom.
    list_resp = client.get(f"/api/classrooms/{c1_id}/sessions", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert list_resp.status_code == 200
    sessions_list = list_resp.json()
    assert len(sessions_list) >= 1
    assert sessions_list[0]["id"] == s1_id

    # 10. Teacher cannot list another teacher's classroom sessions.
    list_t2_resp = client.get(f"/api/classrooms/{c1_id}/sessions", headers={"Authorization": f"Bearer {teacher2_token}"})
    assert list_t2_resp.status_code == 403

    # 13. Scheduled session cannot be ended directly.
    end_early_resp = client.post(f"/api/sessions/{s1_id}/end", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert end_early_resp.status_code == 400
    assert "started first" in end_early_resp.json()["detail"].lower()

    # 11. Scheduled session can be started.
    start_resp = client.post(f"/api/sessions/{s1_id}/start", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert start_resp.status_code == 200
    active_session = start_resp.json()
    assert active_session["status"] == "active"
    assert active_session["started_at"] is not None # 19. started_at populated on start
    assert active_session["ended_at"] is None

    # 14. Active session cannot be started again.
    start_again_resp = client.post(f"/api/sessions/{s1_id}/start", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert start_again_resp.status_code == 400
    assert "already active" in start_again_resp.json()["detail"].lower()

    # 12. Active session can be ended.
    end_resp = client.post(f"/api/sessions/{s1_id}/end", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert end_resp.status_code == 200
    ended_session = end_resp.json()
    assert ended_session["status"] == "ended"
    assert ended_session["started_at"] is not None
    assert ended_session["ended_at"] is not None # 20. ended_at populated on end

    # 15. Ended session cannot be started again.
    start_ended_resp = client.post(f"/api/sessions/{s1_id}/start", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert start_ended_resp.status_code == 400
    assert "ended" in start_ended_resp.json()["detail"].lower()

    # 16. Ended session cannot be ended again.
    end_ended_resp = client.post(f"/api/sessions/{s1_id}/end", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert end_ended_resp.status_code == 400
    assert "already ended" in end_ended_resp.json()["detail"].lower()

    # 17. Invalid session ID returns safe 404.
    invalid_get_resp = client.get("/api/sessions/nonexistent-session-id", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert invalid_get_resp.status_code == 404

    invalid_start_resp = client.post("/api/sessions/nonexistent-session-id/start", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert invalid_start_resp.status_code == 404

    invalid_end_resp = client.post("/api/sessions/nonexistent-session-id/end", headers={"Authorization": f"Bearer {teacher1_token}"})
    assert invalid_end_resp.status_code == 404
