import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException
from app.schemas.participant import (
    ParticipantResponse,
    ParticipantDetailResponse,
    ActiveSessionLookupResponse
)

def join_session(db, session_id: str, student_id: str) -> ParticipantResponse:
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    status = session.get("status")
    if status == "scheduled":
        raise HTTPException(
            status_code=400,
            detail="Cannot join a scheduled session. Please wait for the teacher to start it."
        )
    if status == "ended":
        raise HTTPException(
            status_code=400,
            detail="Cannot join an ended session."
        )
    if status != "active":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot join session with status '{status}'"
        )

    classroom_id = session["classroom_id"]

    # Check for existing active participation
    active_p = db.participants.find_one({
        "session_id": session_id,
        "student_id": student_id,
        "status": "joined"
    })
    if active_p:
        raise HTTPException(
            status_code=400,
            detail="Student is already actively joined in this session."
        )

    participant_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "_id": participant_id,
        "session_id": session_id,
        "classroom_id": classroom_id,
        "student_id": student_id,
        "joined_at": now,
        "left_at": None,
        "status": "joined"
    }

    db.participants.insert_one(doc)
    doc["id"] = doc.pop("_id")
    return ParticipantResponse(**doc)

def leave_session(db, session_id: str, student_id: str) -> ParticipantResponse:
    active_p = db.participants.find_one({
        "session_id": session_id,
        "student_id": student_id,
        "status": "joined"
    })
    if not active_p:
        past_p = db.participants.find_one({
            "session_id": session_id,
            "student_id": student_id
        })
        if past_p:
            raise HTTPException(
                status_code=400,
                detail="Student has already left this session."
            )
        raise HTTPException(
            status_code=404,
            detail="Student has not joined this session."
        )

    now = datetime.now(timezone.utc)
    db.participants.update_one(
        {"_id": active_p["_id"]},
        {"$set": {"status": "left", "left_at": now}}
    )

    updated = db.participants.find_one({"_id": active_p["_id"]})
    updated["id"] = updated.pop("_id")
    return ParticipantResponse(**updated)

def get_student_participation(db, session_id: str, student_id: str) -> ParticipantResponse:
    doc = db.participants.find_one(
        {"session_id": session_id, "student_id": student_id},
        sort=[("joined_at", -1)]
    )
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="No participation record found for this session."
        )

    doc["id"] = doc.pop("_id")
    return ParticipantResponse(**doc)

def list_session_participants(db, session_id: str, teacher_id: str) -> List[ParticipantDetailResponse]:
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("teacher_id") != teacher_id:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view participants for this session."
        )

    cursor = db.participants.find({"session_id": session_id}).sort("joined_at", -1)
    results = []
    seen_student_ids = set()
    for p in cursor:
        student_id = p["student_id"]
        if student_id in seen_student_ids:
            continue
        seen_student_ids.add(student_id)

        student = db.users.find_one({"_id": student_id})
        student_name = student.get("name", "Unknown Student") if student else "Unknown Student"
        student_email = student.get("email", "") if student else ""
        results.append(
            ParticipantDetailResponse(
                id=p["_id"],
                session_id=p["session_id"],
                classroom_id=p["classroom_id"],
                student_id=p["student_id"],
                student_name=student_name,
                student_email=student_email,
                joined_at=p["joined_at"],
                left_at=p.get("left_at"),
                status=p["status"]
            )
        )
    return results

def lookup_active_session_by_code(db, join_code: str) -> ActiveSessionLookupResponse:
    classroom = db.classrooms.find_one({
        "join_code": join_code.strip().upper(),
        "is_active": True
    })
    if not classroom:
        raise HTTPException(
            status_code=404,
            detail="Classroom not found or is currently inactive."
        )

    session = db.sessions.find_one({
        "classroom_id": classroom["_id"],
        "status": "active"
    })
    if not session:
        raise HTTPException(
            status_code=404,
            detail="No active session found for this classroom. Please wait for your instructor to start the session."
        )

    return ActiveSessionLookupResponse(
        classroom_id=classroom["_id"],
        classroom_name=classroom["name"],
        join_code=classroom["join_code"],
        session_id=session["_id"],
        session_title=session["title"],
        status=session["status"]
    )
