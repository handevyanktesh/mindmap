from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ReflectionCreate(BaseModel):
    session_id: Optional[str] = None
    what_went_well: str = Field(..., min_length=1, max_length=2000, description="What went well during this learning session")
    what_was_difficult: str = Field(..., min_length=1, max_length=2000, description="What was challenging or difficult")
    improvement_goal: str = Field(..., min_length=1, max_length=2000, description="Actionable goal for the next learning session")

class ReflectionUpdate(BaseModel):
    what_went_well: Optional[str] = Field(None, min_length=1, max_length=2000)
    what_was_difficult: Optional[str] = Field(None, min_length=1, max_length=2000)
    improvement_goal: Optional[str] = Field(None, min_length=1, max_length=2000)

class ReflectionResponse(BaseModel):
    id: str
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
