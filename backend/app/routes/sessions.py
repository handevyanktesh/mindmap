from typing import List
from fastapi import APIRouter, Depends
from app.api.deps import get_db, require_teacher, require_student
from app.schemas.session import SessionCreate, SessionResponse
from app.schemas.participant import ParticipantResponse, ParticipantDetailResponse
from app.services.session_service import (
    create_session,
    get_session,
    start_session,
    end_session
)
from app.services.participant_service import (
    join_session,
    leave_session,
    get_student_participation,
    list_session_participants
)
from app.services.connection_manager import manager

router = APIRouter()

@router.post("/", response_model=SessionResponse)
def create(
    session_in: SessionCreate,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return create_session(db, session_in, current_user["id"])

@router.get("/{session_id}", response_model=SessionResponse)
def get_one(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return get_session(db, session_id, current_user["id"])

@router.post("/{session_id}/start", response_model=SessionResponse)
def start(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return start_session(db, session_id, current_user["id"])

@router.post("/{session_id}/end", response_model=SessionResponse)
async def end(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    result = end_session(db, session_id, current_user["id"])
    await manager.broadcast_to_session(session_id, {
        "type": "session_ended",
        "session_id": session_id
    })
    return result

# --- Student Participation Routes ---

@router.post("/{session_id}/join", response_model=ParticipantResponse)
def join(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return join_session(db, session_id, current_user["id"])

@router.post("/{session_id}/leave", response_model=ParticipantResponse)
def leave(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return leave_session(db, session_id, current_user["id"])

@router.get("/{session_id}/participation", response_model=ParticipantResponse)
def get_participation(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return get_student_participation(db, session_id, current_user["id"])

# --- Teacher Participant Listing Route ---

@router.get("/{session_id}/participants", response_model=List[ParticipantDetailResponse])
def get_participants(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return list_session_participants(db, session_id, current_user["id"])
