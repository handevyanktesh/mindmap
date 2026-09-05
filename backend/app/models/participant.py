from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ParticipantModel(BaseModel):
    id: str = Field(alias="_id")
    session_id: str
    student_id: str
    joined_at: datetime = Field(default_factory=datetime.utcnow)
    left_at: Optional[datetime] = None

    class Config:
        populate_by_name = True
