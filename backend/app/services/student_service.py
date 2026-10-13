from datetime import datetime, timezone
from typing import List
from fastapi import HTTPException
from app.schemas.student import StudentSessionHistoryItem, StudentSessionDetailResponse
from app.schemas.reflection import ReflectionResponse
from app.services.analytics_service import format_duration

def get_student_session_history(db, student_id: str) -> List[StudentSessionHistoryItem]:
    # 1. Fetch all participation records for this student
    cursor = db.participants.find({"student_id": student_id}).sort("joined_at", -1)

    seen_sessions = set()
    history: List[StudentSessionHistoryItem] = []

    for p in cursor:
        session_id = p["session_id"]
        if session_id in seen_sessions:
            continue
        seen_sessions.add(session_id)

        session = db.sessions.find_one({"_id": session_id})
        if not session:
            continue

        classroom_id = session.get("classroom_id", "")
        classroom = db.classrooms.find_one({"_id": classroom_id})
        classroom_name = classroom.get("name", "Classroom") if classroom else "Classroom"

        joined_at = p.get("joined_at")
        left_at = p.get("left_at")
        duration_sec = None
        if joined_at:
            end_t = left_at or (session.get("ended_at") or datetime.now(timezone.utc))
            if hasattr(joined_at, "tzinfo") and joined_at.tzinfo is None:
                joined_at = joined_at.replace(tzinfo=timezone.utc)
            if hasattr(end_t, "tzinfo") and end_t.tzinfo is None:
                end_t = end_t.replace(tzinfo=timezone.utc)
            duration_sec = max(0, int((end_t - joined_at).total_seconds()))

        # Check classroom-level persisted analytics summary
        persisted_summary = db.session_analytics_summaries.find_one({"session_id": session_id})
        classroom_normal_pct = None
        classroom_elevated_confusion_pct = None
        telemetry_status = "unavailable"

        if persisted_summary:
            telemetry_status = persisted_summary.get("telemetry_status", "persisted")
            eng = persisted_summary.get("engagement_distribution", {})
            conf = persisted_summary.get("confusion_distribution", {})
            classroom_normal_pct = eng.get("normal_pct")
            classroom_elevated_confusion_pct = conf.get("elevated_pct")
        elif session.get("status") == "active":
            telemetry_status = "in_memory_live_only"

        # Check if student has written a reflection for this session
        refl = db.reflections.find_one({"student_id": student_id, "session_id": session_id})
        has_refl = refl is not None
        refl_id = str(refl["_id"]) if refl else None

        history.append(StudentSessionHistoryItem(
            session_id=session_id,
            classroom_id=classroom_id,
            classroom_name=classroom_name,
            session_title=session.get("title", "Untitled Session"),
            session_status=session.get("status", "ended"),
            joined_at=joined_at,
            left_at=left_at,
            participation_duration_seconds=duration_sec,
            participation_duration_formatted=format_duration(duration_sec),
            telemetry_status=telemetry_status,
            classroom_normal_pct=classroom_normal_pct,
            classroom_elevated_confusion_pct=classroom_elevated_confusion_pct,
            has_reflection=has_refl,
            reflection_id=refl_id
        ))

    return history

def get_student_session_details(db, session_id: str, student_id: str) -> StudentSessionDetailResponse:
    # 1. Authorize student: Must have participated in the session
    participation = db.participants.find_one({
        "session_id": session_id,
        "student_id": student_id
    }, sort=[("joined_at", -1)])

    if not participation:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view details for a session you did not attend"
        )

    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    classroom_id = session.get("classroom_id", "")
    classroom = db.classrooms.find_one({"_id": classroom_id})
    classroom_name = classroom.get("name", "Classroom") if classroom else "Classroom"

    joined_at = participation.get("joined_at")
    left_at = participation.get("left_at")
    duration_sec = None
    if joined_at:
        end_t = left_at or (session.get("ended_at") or datetime.now(timezone.utc))
        if hasattr(joined_at, "tzinfo") and joined_at.tzinfo is None:
            joined_at = joined_at.replace(tzinfo=timezone.utc)
        if hasattr(end_t, "tzinfo") and end_t.tzinfo is None:
            end_t = end_t.replace(tzinfo=timezone.utc)
        duration_sec = max(0, int((end_t - joined_at).total_seconds()))

    persisted_summary = db.session_analytics_summaries.find_one({"session_id": session_id})
    classroom_normal_pct = None
    classroom_elevated_confusion_pct = None
    telemetry_status = "unavailable"

    if persisted_summary:
        telemetry_status = persisted_summary.get("telemetry_status", "persisted")
        eng = persisted_summary.get("engagement_distribution", {})
        conf = persisted_summary.get("confusion_distribution", {})
        classroom_normal_pct = eng.get("normal_pct")
        classroom_elevated_confusion_pct = conf.get("elevated_pct")
    elif session.get("status") == "active":
        telemetry_status = "in_memory_live_only"

    # Fetch private reflection if student authored one
    refl_doc = db.reflections.find_one({"student_id": student_id, "session_id": session_id})
    refl_response = None
    if refl_doc:
        refl_doc["id"] = refl_doc.pop("_id")
        refl_response = ReflectionResponse(**refl_doc)

    return StudentSessionDetailResponse(
        session_id=session_id,
        classroom_id=classroom_id,
        classroom_name=classroom_name,
        session_title=session.get("title", "Session"),
        session_description=session.get("description"),
        session_status=session.get("status", "ended"),
        started_at=session.get("started_at"),
        ended_at=session.get("ended_at"),
        student_joined_at=joined_at,
        student_left_at=left_at,
        participation_duration_formatted=format_duration(duration_sec),
        telemetry_status=telemetry_status,
        classroom_normal_pct=classroom_normal_pct,
        classroom_elevated_confusion_pct=classroom_elevated_confusion_pct,
        reflection=refl_response
    )
