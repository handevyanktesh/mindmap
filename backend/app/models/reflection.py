from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ReflectionModel(BaseModel):
    id: str = Field(alias="_id")
    student_id: str
    session_id: Optional[str] = None
    classroom_id: Optional[str] = None
    session_title: Optional[str] = None
    classroom_name: Optional[str] = None
    what_went_well: str
    what_was_difficult: str
    improvement_goal: str
    created_at: datetime
    updated_at: datetime

    class Config:
        populate_by_name = True
