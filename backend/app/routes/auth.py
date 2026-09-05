from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.api.deps import get_db, get_current_user
from app.schemas.user import UserCreate, UserResponse, Token
from app.services.auth_service import register_user, authenticate_user

router = APIRouter()

class LoginRequest(BaseModel):
    email: str
    password: str

@router.post("/register", response_model=UserResponse)
def register(user_in: UserCreate, db = Depends(get_db)):
    return register_user(db, user_in)

@router.post("/login", response_model=Token)
def login(login_req: LoginRequest, db = Depends(get_db)):
    return authenticate_user(db, login_req.email, login_req.password)

@router.get("/me", response_model=UserResponse)
def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
