import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import HTTPException
from app.schemas.reflection import ReflectionCreate, ReflectionUpdate, ReflectionResponse

def create_reflection(db, reflection_in: ReflectionCreate, student_id: str) -> ReflectionResponse:
    session_id = reflection_in.session_id
    classroom_id = None
    session_title = None
    classroom_name = None

    if session_id:
        session = db.sessions.find_one({"_id": session_id})
        if not session:
            raise HTTPException(status_code=404, detail="Referenced session not found")

        # Verify that the student actually participated in this session
        participation = db.participants.find_one({
            "session_id": session_id,
            "student_id": student_id
        })
        if not participation:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to create a reflection for a session you did not participate in"
            )

        classroom_id = session.get("classroom_id")
        session_title = session.get("title", "Session")
        if classroom_id:
            classroom = db.classrooms.find_one({"_id": classroom_id})
            classroom_name = classroom.get("name", "Classroom") if classroom else "Classroom"

    reflection_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    doc = {
        "_id": reflection_id,
        "student_id": student_id,
        "session_id": session_id,
        "classroom_id": classroom_id,
        "session_title": session_title,
        "classroom_name": classroom_name,
        "what_went_well": reflection_in.what_went_well.strip(),
        "what_was_difficult": reflection_in.what_was_difficult.strip(),
        "improvement_goal": reflection_in.improvement_goal.strip(),
        "created_at": now,
        "updated_at": now
    }

    db.reflections.insert_one(doc)
    doc["id"] = doc.pop("_id")
    return ReflectionResponse(**doc)

def list_student_reflections(db, student_id: str) -> List[ReflectionResponse]:
    cursor = db.reflections.find({"student_id": student_id}).sort("created_at", -1)
    reflections = []
    for doc in cursor:
        doc["id"] = doc.pop("_id")
        reflections.append(ReflectionResponse(**doc))
    return reflections

def get_reflection(db, reflection_id: str, student_id: str) -> ReflectionResponse:
    doc = db.reflections.find_one({"_id": reflection_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Reflection not found")

    if doc.get("student_id") != student_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this private reflection")

    doc["id"] = doc.pop("_id")
    return ReflectionResponse(**doc)

def update_reflection(
    db,
    reflection_id: str,
    reflection_in: ReflectionUpdate,
    student_id: str
) -> ReflectionResponse:
    doc = db.reflections.find_one({"_id": reflection_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Reflection not found")

    if doc.get("student_id") != student_id:
        raise HTTPException(status_code=403, detail="Not authorized to modify this private reflection")

    update_fields = {"updated_at": datetime.now(timezone.utc)}
    if reflection_in.what_went_well is not None:
        update_fields["what_went_well"] = reflection_in.what_went_well.strip()
    if reflection_in.what_was_difficult is not None:
        update_fields["what_was_difficult"] = reflection_in.what_was_difficult.strip()
    if reflection_in.improvement_goal is not None:
        update_fields["improvement_goal"] = reflection_in.improvement_goal.strip()

    db.reflections.update_one({"_id": reflection_id}, {"$set": update_fields})

    updated_doc = db.reflections.find_one({"_id": reflection_id})
    updated_doc["id"] = updated_doc.pop("_id")
    return ReflectionResponse(**updated_doc)

def delete_reflection(db, reflection_id: str, student_id: str) -> dict:
    doc = db.reflections.find_one({"_id": reflection_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Reflection not found")

    if doc.get("student_id") != student_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this private reflection")

    db.reflections.delete_one({"_id": reflection_id})
    return {"status": "ok", "message": "Reflection deleted successfully"}
