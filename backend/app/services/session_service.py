import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException
from app.schemas.session import SessionCreate, SessionResponse

def create_session(db, session_in: SessionCreate, teacher_id: str) -> SessionResponse:
    classroom = db.classrooms.find_one({"_id": session_in.classroom_id})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if not classroom.get("is_active", True):
        raise HTTPException(status_code=400, detail="Cannot create session for inactive classroom")

    if classroom.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to create session in this classroom")

    session_id = str(uuid.uuid4())
    doc = {
        "_id": session_id,
        "classroom_id": session_in.classroom_id,
        "teacher_id": teacher_id,
        "title": session_in.title,
        "description": session_in.description,
        "status": "scheduled",
        "scheduled_at": session_in.scheduled_at,
        "started_at": None,
        "ended_at": None,
        "created_at": datetime.now(timezone.utc)
    }

    db.sessions.insert_one(doc)
    doc["id"] = doc.pop("_id")
    return SessionResponse(**doc)

def get_session(db, session_id: str, teacher_id: str) -> SessionResponse:
    doc = db.sessions.find_one({"_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    if doc.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    doc["id"] = doc.pop("_id")
    return SessionResponse(**doc)

def list_classroom_sessions(db, classroom_id: str, teacher_id: str) -> List[SessionResponse]:
    classroom = db.classrooms.find_one({"_id": classroom_id})
    if not classroom:
        raise HTTPException(status_code=404, detail="Classroom not found")

    if classroom.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to view sessions for this classroom")

    cursor = db.sessions.find({"classroom_id": classroom_id}).sort("created_at", -1)
    sessions = []
    for doc in cursor:
        doc["id"] = doc.pop("_id")
        sessions.append(SessionResponse(**doc))
    return sessions

def start_session(db, session_id: str, teacher_id: str) -> SessionResponse:
    doc = db.sessions.find_one({"_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    if doc.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to start this session")

    if doc.get("status") == "active":
        raise HTTPException(status_code=400, detail="Session is already active")
    if doc.get("status") == "ended":
        raise HTTPException(status_code=400, detail="Cannot start an ended session")
    if doc.get("status") != "scheduled":
        raise HTTPException(status_code=400, detail=f"Cannot start session with status '{doc.get('status')}'")

    now = datetime.now(timezone.utc)
    db.sessions.update_one({"_id": session_id}, {"$set": {"status": "active", "started_at": now}})

    updated_doc = db.sessions.find_one({"_id": session_id})
    updated_doc["id"] = updated_doc.pop("_id")
    return SessionResponse(**updated_doc)

def end_session(db, session_id: str, teacher_id: str) -> SessionResponse:
    doc = db.sessions.find_one({"_id": session_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")

    if doc.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to end this session")

    if doc.get("status") == "ended":
        raise HTTPException(status_code=400, detail="Session is already ended")
    if doc.get("status") == "scheduled":
        raise HTTPException(status_code=400, detail="Cannot end a scheduled session. It must be started first")
    if doc.get("status") != "active":
        raise HTTPException(status_code=400, detail=f"Cannot end session with status '{doc.get('status')}'")

    now = datetime.now(timezone.utc)
    db.sessions.update_one({"_id": session_id}, {"$set": {"status": "ended", "ended_at": now}})
    db.participants.update_many(
        {"session_id": session_id, "status": "joined"},
        {"$set": {"status": "left", "left_at": now}}
    )

    updated_doc = db.sessions.find_one({"_id": session_id})
    updated_doc["id"] = updated_doc.pop("_id")
    return SessionResponse(**updated_doc)
