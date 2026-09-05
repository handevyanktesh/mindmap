import uuid
import secrets
import string
from datetime import datetime
from fastapi import HTTPException
from app.schemas.classroom import ClassroomCreate, ClassroomUpdate, ClassroomResponse

def generate_join_code(db) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    while True:
        code = ''.join(secrets.choice(alphabet) for _ in range(6))
        if not db.classrooms.find_one({"join_code": code}):
            return code

def create_classroom(db, classroom_in: ClassroomCreate, teacher_id: str) -> ClassroomResponse:
    classroom_id = str(uuid.uuid4())
    join_code = generate_join_code(db)
    
    doc = {
        "_id": classroom_id,
        "name": classroom_in.name,
        "description": classroom_in.description,
        "join_code": join_code,
        "teacher_id": teacher_id,
        "created_at": datetime.utcnow(),
        "is_active": True
    }
    
    db.classrooms.insert_one(doc)
    doc["id"] = doc.pop("_id")
    return ClassroomResponse(**doc)

def get_classrooms_for_teacher(db, teacher_id: str):
    cursor = db.classrooms.find({"teacher_id": teacher_id})
    classrooms = []
    for doc in cursor:
        doc["id"] = doc.pop("_id")
        classrooms.append(ClassroomResponse(**doc))
    return classrooms

def get_classroom_by_id(db, classroom_id: str, user_id: str, user_role: str) -> ClassroomResponse:
    doc = db.classrooms.find_one({"_id": classroom_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    if user_role == "teacher":
        if doc["teacher_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to access this classroom")
    else:
        # TODO: Check student membership when implemented
        pass
        
    doc["id"] = doc.pop("_id")
    return ClassroomResponse(**doc)

def update_classroom(db, classroom_id: str, classroom_in: ClassroomUpdate, teacher_id: str) -> ClassroomResponse:
    doc = db.classrooms.find_one({"_id": classroom_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    if doc["teacher_id"] != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this classroom")
        
    update_data = {k: v for k, v in classroom_in.dict(exclude_unset=True).items()}
    if update_data:
        db.classrooms.update_one({"_id": classroom_id}, {"$set": update_data})
        
    updated_doc = db.classrooms.find_one({"_id": classroom_id})
    updated_doc["id"] = updated_doc.pop("_id")
    return ClassroomResponse(**updated_doc)

def delete_classroom(db, classroom_id: str, teacher_id: str) -> ClassroomResponse:
    # Soft delete (deactivation) because sessions/participants may reference it
    doc = db.classrooms.find_one({"_id": classroom_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Classroom not found")
        
    if doc["teacher_id"] != teacher_id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this classroom")
        
    db.classrooms.update_one({"_id": classroom_id}, {"$set": {"is_active": False}})
    
    updated_doc = db.classrooms.find_one({"_id": classroom_id})
    updated_doc["id"] = updated_doc.pop("_id")
    return ClassroomResponse(**updated_doc)
