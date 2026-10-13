from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field

class ChatMessageModel(BaseModel):
    id: Optional[str] = None
    session_id: str
    classroom_id: str
    sender_id: str
    sender_name: str
    sender_role: str  # "teacher" | "student" | "system"
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    class Config:
        populate_by_name = True
