from pydantic import BaseModel
from typing import Optional, List
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

class ParticipantSummary(BaseModel):
    student_id: str
    student_name: str
    student_email: str
    status: str
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None

class SessionSummaryResponse(BaseModel):
    id: str
    classroom_id: str
    classroom_name: str
    title: str
    description: Optional[str] = None
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    duration_seconds: int
    total_participants: int
    active_participants: int
    left_participants: int
    participants: List[ParticipantSummary]
    telemetry_status: str
