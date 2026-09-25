from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class SessionModel(BaseModel):
    id: str = Field(alias="_id")
    classroom_id: str
    teacher_id: str
    title: str
    description: Optional[str] = None
    status: str = "scheduled" # 'scheduled', 'active', 'ended'
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        populate_by_name = True
