import uuid
from datetime import datetime
from fastapi import HTTPException
from app.core.security import get_password_hash, verify_password, create_access_token
from app.schemas.user import UserCreate, UserResponse, Token

def register_user(db, user_in: UserCreate) -> UserResponse:
    if user_in.role not in ["student", "teacher"]:
        raise HTTPException(status_code=400, detail="Invalid role")

    email = user_in.email.lower()
    existing_user = db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_in.password)

    user_doc = {
        "_id": user_id,
        "name": user_in.name,
        "email": email,
        "password_hash": hashed_password,
        "role": user_in.role,
        "created_at": datetime.utcnow()
    }

    db.users.insert_one(user_doc)

    user_doc["id"] = user_doc.pop("_id")
    return UserResponse(**user_doc)

def authenticate_user(db, email: str, password: str) -> Token:
    email = email.lower()
    user = db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    if not verify_password(password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token = create_access_token(subject=user["_id"], role=user["role"])
    
    user["id"] = user.pop("_id")
    user_response = UserResponse(**user)
    
    return Token(access_token=access_token, token_type="bearer", user=user_response)
