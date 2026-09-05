from fastapi import APIRouter

router = APIRouter()

@router.post("/")
def create_session():
    return {"message": "Not implemented yet"}

@router.get("/{session_id}")
def get_session(session_id: str):
    return {"message": "Not implemented yet", "session_id": session_id}
