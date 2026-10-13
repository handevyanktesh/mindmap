from typing import List
from fastapi import APIRouter, Depends, Query, status
from app.api.deps import get_db, get_current_user
from app.schemas.chat import ChatMessageResponse
from app.services.chat_service import get_session_chat_history

router = APIRouter()

@router.get("/{session_id}/chat", response_model=List[ChatMessageResponse])
def get_chat_history(
    session_id: str,
    limit: int = Query(100, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
    db = Depends(get_db)
):
    """
    Retrieve message history for an authorized classroom session.
    Only teachers owning the classroom or students participating in the session can view chat history.
    """
    return get_session_chat_history(
        db=db,
        session_id=session_id,
        user=current_user,
        limit=limit
    )
