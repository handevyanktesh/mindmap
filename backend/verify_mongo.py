import sys
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_database

def verify():
    print("Starting verification...")
    
    with TestClient(app) as client:
        print("Checking MongoDB Connection...")
        db = get_database()
        if db is not None:
            print(f"MongoDB Atlas connection successful")
            print(f"Database: {db.name}")
            
            try:
                # Simple ping
                db.command("ping")
                print("PyMongo ping result: OK")
            except Exception as e:
                print(f"Ping failed: {e}")
        else:
            print("MongoDB connection failed or db is None.")

        print("Testing /health endpoint...")
        response = client.get("/health")
        if response.status_code == 200 and response.json() == {"status": "ok"}:
            print("/health endpoint is working.")
        else:
            print(f"/health failed with status {response.status_code}")

if __name__ == "__main__":
    verify()
