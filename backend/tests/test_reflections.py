import pytest
from datetime import datetime, timezone

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


def test_reflection_validation(client):
    """Test text boundary validation on reflections."""
    stu_token = get_auth_token(client, "refl_val_stu@test.com", "student")
    headers = {"Authorization": f"Bearer {stu_token}"}

    # Empty text fails validation
    resp = client.post("/api/reflections/", json={
        "what_went_well": "",
        "what_was_difficult": "Nothing",
        "improvement_goal": "Keep going"
    }, headers=headers)
    assert resp.status_code == 422

    # String exceeding 2000 chars fails validation
    long_text = "a" * 2001
    resp = client.post("/api/reflections/", json={
        "what_went_well": long_text,
        "what_was_difficult": "Nothing",
        "improvement_goal": "Keep going"
    }, headers=headers)
    assert resp.status_code == 422


def test_role_isolation_teacher_forbidden(client):
    """Teachers must be forbidden from accessing student reflection endpoints."""
    teacher_token = get_auth_token(client, "refl_teacher@test.com", "teacher")
    headers = {"Authorization": f"Bearer {teacher_token}"}

    # List reflections
    resp = client.get("/api/reflections/", headers=headers)
    assert resp.status_code == 403

    # Create reflection
    resp = client.post("/api/reflections/", json={
        "what_went_well": "Teaching was great",
        "what_was_difficult": "None",
        "improvement_goal": "Teach better"
    }, headers=headers)
    assert resp.status_code == 403

    # Student session history
    resp = client.get("/api/sessions/student/history", headers=headers)
    assert resp.status_code == 403


def test_reflection_crud_and_cross_student_isolation(client):
    """Verify CRUD lifecycle and strict student-to-student data isolation."""
    stu1_token = get_auth_token(client, "refl_stu1@test.com", "student")
    stu2_token = get_auth_token(client, "refl_stu2@test.com", "student")
    h1 = {"Authorization": f"Bearer {stu1_token}"}
    h2 = {"Authorization": f"Bearer {stu2_token}"}

    # 1. Student 1 creates a standalone reflection (no session linked)
    create_resp = client.post("/api/reflections/", json={
        "what_went_well": "I stayed focused during independent study.",
        "what_was_difficult": "Complex integrals were challenging.",
        "improvement_goal": "Practice 5 integration problems tomorrow."
    }, headers=h1)
    assert create_resp.status_code == 201
    refl_data = create_resp.json()
    refl_id = refl_data["id"]
    assert refl_data["what_went_well"] == "I stayed focused during independent study."
    assert refl_data["session_id"] is None

    # 2. Student 1 lists reflections -> present
    list1_resp = client.get("/api/reflections/", headers=h1)
    assert list1_resp.status_code == 200
    items1 = list1_resp.json()
    assert any(r["id"] == refl_id for r in items1)

    # 3. Student 2 lists reflections -> Student 1's reflection is NOT visible
    list2_resp = client.get("/api/reflections/", headers=h2)
    assert list2_resp.status_code == 200
    items2 = list2_resp.json()
    assert not any(r["id"] == refl_id for r in items2)

    # 4. Student 2 attempts to GET Student 1's reflection directly -> 403 Forbidden
    get_stu2_resp = client.get(f"/api/reflections/{refl_id}", headers=h2)
    assert get_stu2_resp.status_code == 403

    # 5. Student 2 attempts to UPDATE Student 1's reflection -> 403 Forbidden
    put_stu2_resp = client.put(f"/api/reflections/{refl_id}", json={
        "what_went_well": "Hacked content"
    }, headers=h2)
    assert put_stu2_resp.status_code == 403

    # 6. Student 2 attempts to DELETE Student 1's reflection -> 403 Forbidden
    del_stu2_resp = client.delete(f"/api/reflections/{refl_id}", headers=h2)
    assert del_stu2_resp.status_code == 403

    # 7. Student 1 updates their reflection -> 200 OK
    update_resp = client.put(f"/api/reflections/{refl_id}", json={
        "what_went_well": "I stayed focused and solved 3 problems.",
        "improvement_goal": "Practice 10 integration problems tomorrow."
    }, headers=h1)
    assert update_resp.status_code == 200
    assert update_resp.json()["what_went_well"] == "I stayed focused and solved 3 problems."
    assert update_resp.json()["what_was_difficult"] == "Complex integrals were challenging."  # Preserved

    # 8. Student 1 deletes their reflection -> 200 OK
    del_stu1_resp = client.delete(f"/api/reflections/{refl_id}", headers=h1)
    assert del_stu1_resp.status_code == 200

    # 9. GET deleted reflection -> 404 Not Found
    get_deleted = client.get(f"/api/reflections/{refl_id}", headers=h1)
    assert get_deleted.status_code == 404


def test_session_participation_verification_and_details(client, test_db):
    """Test linking reflection to attended session and student session history/details."""
    teacher_token = get_auth_token(client, "refl_sess_teach@test.com", "teacher")
    stu1_token = get_auth_token(client, "refl_sess_stu1@test.com", "student")
    stu2_token = get_auth_token(client, "refl_sess_stu2@test.com", "student")

    th = {"Authorization": f"Bearer {teacher_token}"}
    s1h = {"Authorization": f"Bearer {stu1_token}"}
    s2h = {"Authorization": f"Bearer {stu2_token}"}

    # 1. Teacher creates classroom and starts a session
    c_resp = client.post("/api/classrooms/", json={
        "name": "Physics 201",
        "description": "Electromagnetism"
    }, headers=th)
    class_id = c_resp.json()["id"]

    s_resp = client.post("/api/sessions/", json={
        "classroom_id": class_id,
        "title": "Gauss's Law"
    }, headers=th)
    sess_id = s_resp.json()["id"]

    client.post(f"/api/sessions/{sess_id}/start", headers=th)

    # 2. Student 1 joins the session
    join_resp = client.post(f"/api/sessions/{sess_id}/join", headers=s1h)
    assert join_resp.status_code == 200

    # 3. Student 2 tries to link a reflection to this session WITHOUT participating -> 403 Forbidden
    refl_fail = client.post("/api/reflections/", json={
        "session_id": sess_id,
        "what_went_well": "I tried to review Gauss's Law",
        "what_was_difficult": "Everything",
        "improvement_goal": "Attend next time"
    }, headers=s2h)
    assert refl_fail.status_code == 403
    assert "participate" in refl_fail.json()["detail"].lower()

    # 4. Student 1 links a reflection to the attended session -> 201 Created
    refl_ok = client.post("/api/reflections/", json={
        "session_id": sess_id,
        "what_went_well": "Gauss's Law surface integrals made sense",
        "what_was_difficult": "Flux calculation through cylinders",
        "improvement_goal": "Review cylindrical coordinates"
    }, headers=s1h)
    assert refl_ok.status_code == 201
    assert refl_ok.json()["session_id"] == sess_id
    assert refl_ok.json()["session_title"] == "Gauss's Law"
    assert refl_ok.json()["classroom_name"] == "Physics 201"

    # 5. Teacher ends the session
    client.post(f"/api/sessions/{sess_id}/end", headers=th)

    # 6. Student 1 checks student session history -> includes Gauss's Law
    hist1 = client.get("/api/sessions/student/history", headers=s1h)
    assert hist1.status_code == 200
    hist1_items = hist1.json()
    assert any(item["session_id"] == sess_id for item in hist1_items)

    # 7. Student 2 checks student session history -> does NOT include Gauss's Law
    hist2 = client.get("/api/sessions/student/history", headers=s2h)
    assert hist2.status_code == 200
    hist2_items = hist2.json()
    assert not any(item["session_id"] == sess_id for item in hist2_items)

    # 8. Student 1 checks student session details -> 200 OK with privacy-preserving cohort metrics
    detail1 = client.get(f"/api/sessions/{sess_id}/student-details", headers=s1h)
    assert detail1.status_code == 200
    d_data = detail1.json()
    assert d_data["session_id"] == sess_id
    assert d_data["session_title"] == "Gauss's Law"
    assert d_data["classroom_name"] == "Physics 201"
    assert "student_joined_at" in d_data
    assert "participation_duration_formatted" in d_data
    # Aggregate classroom rates present
    assert "classroom_normal_pct" in d_data
    assert "classroom_elevated_confusion_pct" in d_data
    assert d_data["reflection"] is not None
    assert d_data["reflection"]["id"] == refl_ok.json()["id"]
    # Privacy invariant check: Ensure NO individual biometric fields exist in the payload
    assert "attention_score" not in d_data
    assert "ear" not in d_data
    assert "gaze" not in d_data
    assert "head_pose" not in d_data
    assert "landmarks" not in d_data

    # 9. Student 2 checks student session details -> 403 Forbidden (did not attend)
    detail2 = client.get(f"/api/sessions/{sess_id}/student-details", headers=s2h)
    assert detail2.status_code == 403
