from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ClassroomModel(BaseModel):
    id: str = Field(alias="_id")
    name: str
    subject: str
    description: Optional[str] = None
    join_code: str
    teacher_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
