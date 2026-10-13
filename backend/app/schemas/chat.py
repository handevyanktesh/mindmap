from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class ChatMessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500, description="Chat message text (1-500 characters)")

class ChatMessageResponse(BaseModel):
    id: str
    session_id: str
    classroom_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    content: str
    created_at: datetime
