from fastapi import APIRouter, Depends
from app.api.deps import get_db, require_teacher
from app.schemas.session import SessionCreate, SessionResponse
from app.services.session_service import (
    create_session,
    get_session,
    start_session,
    end_session
)

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
def end(
    session_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return end_session(db, session_id, current_user["id"])
