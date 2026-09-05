from pydantic import BaseModel, Field, EmailStr
from datetime import datetime
from typing import Optional

class UserModel(BaseModel):
    id: str = Field(alias="_id")
    name: str
    email: EmailStr
    password_hash: str
    role: str # 'student' or 'teacher'
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
