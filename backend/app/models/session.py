from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class SessionModel(BaseModel):
    id: str = Field(alias="_id")
    classroom_id: str
    started_at: datetime = Field(default_factory=datetime.utcnow)
    ended_at: Optional[datetime] = None
    status: str # 'active', 'ended', 'scheduled'

    class Config:
        populate_by_name = True
