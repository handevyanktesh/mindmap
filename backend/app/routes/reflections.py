from typing import List
from fastapi import APIRouter, Depends, status
from app.api.deps import get_db, require_student
from app.schemas.reflection import ReflectionCreate, ReflectionUpdate, ReflectionResponse
from app.services.reflection_service import (
    create_reflection,
    list_student_reflections,
    get_reflection,
    update_reflection,
    delete_reflection
)

router = APIRouter()

@router.post("/", response_model=ReflectionResponse, status_code=status.HTTP_201_CREATED)
def create(
    reflection_in: ReflectionCreate,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return create_reflection(db, reflection_in, current_user["id"])

@router.get("/", response_model=List[ReflectionResponse])
def get_all(
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return list_student_reflections(db, current_user["id"])

@router.get("/{reflection_id}", response_model=ReflectionResponse)
def get_one(
    reflection_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return get_reflection(db, reflection_id, current_user["id"])

@router.put("/{reflection_id}", response_model=ReflectionResponse)
def update(
    reflection_id: str,
    reflection_in: ReflectionUpdate,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return update_reflection(db, reflection_id, reflection_in, current_user["id"])

@router.delete("/{reflection_id}")
def delete(
    reflection_id: str,
    db = Depends(get_db),
    current_user: dict = Depends(require_student)
):
    return delete_reflection(db, reflection_id, current_user["id"])
