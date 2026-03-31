from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from database import get_db
from auth.password import hash_password, verify_password
from auth.jwt_handler import create_access_token
from auth.dependencies import get_current_user
import uuid
from datetime import datetime

router = APIRouter(prefix="/api/auth", tags=["auth"])

class AuthRequest(BaseModel):
    username: str
    password: str

@router.post("/register")
async def register(req: AuthRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db = get_db()
    existing = await db.users.find_one({"username": req.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = {
        "_id": str(uuid.uuid4()),
        "username": req.username,
        "hashed_password": hash_password(req.password),
        "created_at": datetime.utcnow()
    }
    await db.users.insert_one(user)
    token = create_access_token({"sub": user["_id"], "username": user["username"]})
    return {"access_token": token, "token_type": "bearer", "username": user["username"]}

@router.post("/login")
async def login(req: AuthRequest):
    db = get_db()
    user = await db.users.find_one({"username": req.username})
    if not user or not verify_password(req.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid username or password")

    token = create_access_token({"sub": user["_id"], "username": user["username"]})
    return {"access_token": token, "token_type": "bearer", "username": user["username"]}

@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {"id": current_user["_id"], "username": current_user["username"]}
