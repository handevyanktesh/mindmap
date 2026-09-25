from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ParticipantResponse(BaseModel):
    id: str
    session_id: str
    classroom_id: str
    student_id: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    status: str

class ParticipantDetailResponse(BaseModel):
    id: str
    session_id: str
    classroom_id: str
    student_id: str
    student_name: str
    student_email: str
    joined_at: datetime
    left_at: Optional[datetime] = None
    status: str

class ActiveSessionLookupResponse(BaseModel):
    classroom_id: str
    classroom_name: str
    join_code: str
    session_id: str
    session_title: str
    status: str
