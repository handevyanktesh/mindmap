import pytest

def test_create_classroom_unauthenticated(client):
    response = client.post("/api/classrooms/", json={"name": "Test Class"})
    assert response.status_code == 401

def test_student_cannot_create_classroom(client):
    # Register and login student
    client.post("/api/auth/register", json={
        "name": "Student A",
        "email": "studentA@test.com",
        "password": "pass",
        "role": "student"
    })
    token = client.post("/api/auth/login", json={"email": "studentA@test.com", "password": "pass"}).json()["access_token"]
    
    response = client.post("/api/classrooms/", json={"name": "Test Class"}, headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 403

def test_teacher_classroom_flow(client):
    # 1. Register teacher A
    client.post("/api/auth/register", json={
        "name": "Teacher A",
        "email": "teacherA@test.com",
        "password": "pass",
        "role": "teacher"
    })
    token_a = client.post("/api/auth/login", json={"email": "teacherA@test.com", "password": "pass"}).json()["access_token"]
    
    # Register teacher B
    client.post("/api/auth/register", json={
        "name": "Teacher B",
        "email": "teacherB@test.com",
        "password": "pass",
        "role": "teacher"
    })
    token_b = client.post("/api/auth/login", json={"email": "teacherB@test.com", "password": "pass"}).json()["access_token"]
    
    # 2. Teacher A creates classroom
    resp = client.post("/api/classrooms/", json={"name": "Class A"}, headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    class_a = resp.json()
    assert class_a["name"] == "Class A"
    assert "join_code" in class_a
    assert class_a["is_active"] is True
    
    # 3. Teacher A retrieves classrooms
    resp = client.get("/api/classrooms/", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == class_a["id"]
    
    # Teacher B retrieves classrooms (should be empty for B)
    resp = client.get("/api/classrooms/", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 200
    assert len(resp.json()) == 0
    
    # 4. Teacher B tries to modify Teacher A's classroom
    resp = client.put(f"/api/classrooms/{class_a['id']}", json={"name": "Hacked"}, headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 403
    
    # Teacher B tries to delete Teacher A's classroom
    resp = client.delete(f"/api/classrooms/{class_a['id']}", headers={"Authorization": f"Bearer {token_b}"})
    assert resp.status_code == 403
    
    # 5. Teacher A updates classroom
    resp = client.put(f"/api/classrooms/{class_a['id']}", json={"name": "Updated Class A"}, headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Class A"
    
    # 6. Teacher A deactivates classroom
    resp = client.delete(f"/api/classrooms/{class_a['id']}", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False
    
    # 7. Invalid ID
    resp = client.get("/api/classrooms/invalid_id", headers={"Authorization": f"Bearer {token_a}"})
    assert resp.status_code == 404
