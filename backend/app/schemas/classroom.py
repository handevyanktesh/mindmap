from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ClassroomCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ClassroomUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ClassroomResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    join_code: str
    teacher_id: str
    created_at: datetime
    is_active: bool
