from fastapi.testclient import TestClient
from app.main import app

def test_cors_preflight_production_frontend():
    with TestClient(app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "https://mindmap.devanshupatil.tech",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://mindmap.devanshupatil.tech"
        assert response.headers.get("access-control-allow-credentials") == "true"

def test_cors_preflight_vercel_regex():
    with TestClient(app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "https://mindmap-preview-123.vercel.app",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "https://mindmap-preview-123.vercel.app"

def test_cors_preflight_localhost():
    with TestClient(app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

def test_cors_disallowed_origin():
    with TestClient(app) as client:
        response = client.options(
            "/health",
            headers={
                "Origin": "https://malicious-site.example.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers

def test_server_host_port_config(monkeypatch):
    from app.core.config import Settings
    monkeypatch.setenv("PORT", "9090")
    monkeypatch.setenv("HOST", "127.0.0.1")
    custom_settings = Settings()
    assert custom_settings.PORT == 9090
    assert custom_settings.HOST == "127.0.0.1"
