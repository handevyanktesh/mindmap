from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def list_classrooms():
    return {"message": "Not implemented yet"}

@router.post("/")
def create_classroom():
    return {"message": "Not implemented yet"}

@router.get("/{classroom_id}")
def get_classroom(classroom_id: str):
    return {"message": "Not implemented yet", "classroom_id": classroom_id}
