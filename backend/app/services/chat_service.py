import uuid
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import HTTPException, status
from pymongo.database import Database

def verify_session_access(db: Database, session_id: str, user: Dict[str, Any]) -> Dict[str, Any]:
    """
    Verifies that the user has legitimate access to the session.
    Teachers must own the classroom.
    Students must be enrolled or participating in the session.
    Returns the session dict if authorized, otherwise raises HTTPException.
    """
    session = db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )

    user_role = user.get("role")
    user_id = user.get("id")

    if user_role == "teacher":
        classroom = db.classrooms.find_one({"_id": session.get("classroom_id")})
        if not classroom or classroom.get("teacher_id") != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to access chat for this session"
            )
    elif user_role == "student":
        participant = db.participants.find_one({
            "session_id": session_id,
            "student_id": user_id
        })
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a participant in this classroom session"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized role"
        )

    return session


def save_chat_message(
    db: Database,
    session_id: str,
    classroom_id: str,
    sender_id: str,
    sender_name: str,
    sender_role: str,
    content: str
) -> Dict[str, Any]:
    """
    Persists a sanitized, validated chat message into db.chat_messages.
    """
    cleaned_content = content.strip()
    if not cleaned_content or len(cleaned_content) > 500:
        raise ValueError("Message content must be between 1 and 500 characters")

    message_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    doc = {
        "_id": message_id,
        "session_id": session_id,
        "classroom_id": classroom_id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "content": cleaned_content,
        "created_at": now
    }

    db.chat_messages.insert_one(doc)

    return {
        "id": message_id,
        "session_id": session_id,
        "classroom_id": classroom_id,
        "sender_id": sender_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "content": cleaned_content,
        "created_at": now
    }


def get_session_chat_history(
    db: Database,
    session_id: str,
    user: Dict[str, Any],
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Retrieves recent chat history for a session, ordered chronologically.
    """
    verify_session_access(db, session_id, user)

    docs = list(
        db.chat_messages.find({"session_id": session_id})
        .sort("created_at", 1)
        .limit(limit)
    )

    results = []
    for d in docs:
        results.append({
            "id": d["_id"],
            "session_id": d["session_id"],
            "classroom_id": d.get("classroom_id", ""),
            "sender_id": d["sender_id"],
            "sender_name": d["sender_name"],
            "sender_role": d["sender_role"],
            "content": d["content"],
            "created_at": d["created_at"]
        })

    return results
