import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient

from app.main import app
from app.api.deps import get_db
from app.core.config import settings

@pytest.fixture(scope="session")
def test_db():
    if not settings.MONGODB_URI:
        pytest.skip("MONGODB_URI not set, cannot run DB tests")
        
    client = MongoClient(settings.MONGODB_URI)
    db = client["mindmap_test_db"]
    
    # Ensure indexes
    db.users.create_index("email", unique=True)
    db.classrooms.create_index("join_code", unique=True)
    db.classrooms.create_index("teacher_id")
    db.sessions.create_index("classroom_id")
    db.sessions.create_index("teacher_id")
    db.sessions.create_index("status")
    db.sessions.create_index([("classroom_id", 1), ("created_at", -1)])
    
    yield db
    
    # Clean up after tests
    client.drop_database("mindmap_test_db")
    client.close()

@pytest.fixture(scope="module")
def client(test_db):
    def override_get_db():
        return test_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
