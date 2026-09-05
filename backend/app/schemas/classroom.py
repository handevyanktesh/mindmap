from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ClassroomCreate(BaseModel):
    name: str
    subject: str
    description: Optional[str] = None

class ClassroomResponse(BaseModel):
    id: str
    name: str
    subject: str
    description: Optional[str]
    join_code: str
    teacher_id: str
    created_at: datetime
