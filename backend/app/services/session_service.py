import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException
from app.schemas.session import SessionCreate, SessionResponse, SessionSummaryResponse, ParticipantSummary

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

def get_session_summary(db, session_id: str, teacher_id: str) -> SessionSummaryResponse:
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("teacher_id") != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this session")

    classroom = db.classrooms.find_one({"_id": session.get("classroom_id")})
    classroom_name = classroom.get("name", "Classroom") if classroom else "Classroom"

    started_at = session.get("started_at")
    ended_at = session.get("ended_at")
    duration_seconds = 0
    if started_at:
        end_time = ended_at or datetime.now(timezone.utc)
        if hasattr(started_at, "tzinfo") and started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        if hasattr(end_time, "tzinfo") and end_time.tzinfo is None:
            end_time = end_time.replace(tzinfo=timezone.utc)
        duration_seconds = max(0, int((end_time - started_at).total_seconds()))

    cursor = db.participants.find({"session_id": session_id}).sort("joined_at", -1)
    seen_students = set()
    participant_summaries = []
    active_count = 0
    left_count = 0

    for p in cursor:
        sid = p["student_id"]
        if sid in seen_students:
            continue
        seen_students.add(sid)

        student_user = db.users.find_one({"_id": sid})
        s_name = student_user.get("name", "Student") if student_user else "Student"
        s_email = student_user.get("email", "") if student_user else ""

        p_status = p.get("status", "joined")
        if p_status == "joined":
            active_count += 1
        else:
            left_count += 1

        p_joined = p.get("joined_at")
        p_left = p.get("left_at")
        p_duration = None
        if p_joined:
            p_end = p_left or (ended_at or datetime.now(timezone.utc))
            if hasattr(p_joined, "tzinfo") and p_joined.tzinfo is None:
                p_joined = p_joined.replace(tzinfo=timezone.utc)
            if hasattr(p_end, "tzinfo") and p_end.tzinfo is None:
                p_end = p_end.replace(tzinfo=timezone.utc)
            p_duration = max(0, int((p_end - p_joined).total_seconds()))

        participant_summaries.append(ParticipantSummary(
            student_id=sid,
            student_name=s_name,
            student_email=s_email,
            status=p_status,
            joined_at=p_joined,
            left_at=p_left,
            duration_seconds=p_duration
        ))

    return SessionSummaryResponse(
        id=session_id,
        classroom_id=session.get("classroom_id"),
        classroom_name=classroom_name,
        title=session.get("title", ""),
        description=session.get("description"),
        status=session.get("status", "scheduled"),
        started_at=started_at,
        ended_at=ended_at,
        duration_seconds=duration_seconds,
        total_participants=len(seen_students),
        active_participants=active_count,
        left_participants=left_count,
        participants=participant_summaries,
        telemetry_status="in_memory_live_only"
    )
