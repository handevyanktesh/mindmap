def test_register_success(client):
    response = client.post("/api/auth/register", json={
        "name": "Test Student",
        "email": "student@test.com",
        "password": "password123",
        "role": "student"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "student@test.com"
    assert data["role"] == "student"
    assert "id" in data
    assert "password" not in data
    assert "password_hash" not in data

def test_register_duplicate_email(client):
    response = client.post("/api/auth/register", json={
        "name": "Test Student 2",
        "email": "student@test.com",
        "password": "password123",
        "role": "student"
    })
    assert response.status_code == 400
    assert "Email already registered" in response.json()["detail"]

def test_login_success(client):
    response = client.post("/api/auth/login", json={
        "email": "student@test.com",
        "password": "password123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "student@test.com"

def test_login_incorrect_password(client):
    response = client.post("/api/auth/login", json={
        "email": "student@test.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401

def test_login_unknown_email(client):
    response = client.post("/api/auth/login", json={
        "email": "unknown@test.com",
        "password": "password123"
    })
    assert response.status_code == 401

def test_get_me_success(client):
    # First login
    login_resp = client.post("/api/auth/login", json={
        "email": "student@test.com",
        "password": "password123"
    })
    token = login_resp.json()["access_token"]
    
    # Then get me
    response = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "student@test.com"
    assert "password_hash" not in data

def test_get_me_invalid_token(client):
    response = client.get("/api/auth/me", headers={"Authorization": "Bearer invalidtoken"})
    assert response.status_code == 401
