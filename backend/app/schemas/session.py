from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class SessionCreate(BaseModel):
    classroom_id: str

class SessionResponse(BaseModel):
    id: str
    classroom_id: str
    started_at: datetime
    ended_at: Optional[datetime]
    status: str
