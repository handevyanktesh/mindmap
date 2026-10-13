from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.schemas.reflection import ReflectionResponse

class StudentSessionHistoryItem(BaseModel):
    session_id: str
    classroom_id: str
    classroom_name: str
    session_title: str
    session_status: str  # "active", "ended", "scheduled"
    joined_at: datetime
    left_at: Optional[datetime] = None
    participation_duration_seconds: Optional[int] = None
    participation_duration_formatted: str
    telemetry_status: str  # "persisted", "unavailable", "in_memory_live_only"
    classroom_normal_pct: Optional[float] = None  # classroom-level derived estimate
    classroom_elevated_confusion_pct: Optional[float] = None  # classroom-level derived estimate
    has_reflection: bool = False
    reflection_id: Optional[str] = None

class StudentSessionDetailResponse(BaseModel):
    session_id: str
    classroom_id: str
    classroom_name: str
    session_title: str
    session_description: Optional[str] = None
    session_status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    student_joined_at: datetime
    student_left_at: Optional[datetime] = None
    participation_duration_formatted: str
    telemetry_status: str  # "persisted", "unavailable", "in_memory_live_only"
    classroom_normal_pct: Optional[float] = None
    classroom_elevated_confusion_pct: Optional[float] = None
    reflection: Optional[ReflectionResponse] = None
