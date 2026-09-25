from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SessionCreate(BaseModel):
    classroom_id: str
    title: str
    description: Optional[str] = None
    scheduled_at: Optional[datetime] = None

class SessionResponse(BaseModel):
    id: str
    classroom_id: str
    teacher_id: str
    title: str
    description: Optional[str] = None
    status: str
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
