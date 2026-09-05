from typing import List
from fastapi import APIRouter, Depends
from app.api.deps import get_db, require_teacher, get_current_user
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate, ClassroomResponse
from app.services.classroom_service import (
    create_classroom,
    get_classrooms_for_teacher,
    get_classroom_by_id,
    update_classroom,
    delete_classroom
)

router = APIRouter()

@router.post("/", response_model=ClassroomResponse)
def create(
    classroom_in: ClassroomCreate,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return create_classroom(db, classroom_in, current_user["id"])

@router.get("/", response_model=List[ClassroomResponse])
def get_all(
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if current_user["role"] == "teacher":
        return get_classrooms_for_teacher(db, current_user["id"])
    else:
        # Students will eventually get classrooms they belong to
        # Returning empty for now per instructions
        return []

@router.get("/{classroom_id}", response_model=ClassroomResponse)
def get_one(
    classroom_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    return get_classroom_by_id(db, classroom_id, current_user["id"], current_user["role"])

@router.put("/{classroom_id}", response_model=ClassroomResponse)
def update(
    classroom_id: str,
    classroom_in: ClassroomUpdate,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return update_classroom(db, classroom_id, classroom_in, current_user["id"])

@router.delete("/{classroom_id}", response_model=ClassroomResponse)
def delete(
    classroom_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_teacher)
):
    return delete_classroom(db, classroom_id, current_user["id"])
