from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from pydantic import ValidationError
from typing import Optional
from app.core.config import settings
from app.core.database import get_database
from app.schemas.user import TokenPayload
from app.models.user import UserModel

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"/api/auth/login")

def get_db():
    db = get_database()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not initialized")
    return db

def get_user_from_token(token: Optional[str], db) -> Optional[dict]:
    if not token:
        return None
    try:
        payload = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM]
        )
        token_data = TokenPayload(**payload)
    except (jwt.PyJWTError, ValidationError):
        return None
    
    user = db.users.find_one({"_id": token_data.sub})
    if not user:
        return None
    
    user_dict = dict(user)
    user_dict["id"] = user_dict.pop("_id")
    return user_dict

def get_current_user(token: str = Depends(oauth2_scheme), db = Depends(get_db)) -> dict:
    user = get_user_from_token(token, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )
    return user

def require_student(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "student":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

def require_teacher(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "teacher":
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user
