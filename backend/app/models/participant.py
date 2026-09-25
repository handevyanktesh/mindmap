from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class ParticipantModel(BaseModel):
    id: str = Field(alias="_id")
    session_id: str
    classroom_id: str
    student_id: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    status: str = "joined" # 'joined' or 'left'

    class Config:
        populate_by_name = True
