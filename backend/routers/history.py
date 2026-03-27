from fastapi import APIRouter, HTTPException
from typing import List
from database import get_db
from models.db_models import SessionModel, MessageModel

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("/sessions", response_model=List[SessionModel])
async def list_sessions():
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    cursor = db.sessions.find().sort("created_at", -1)
    sessions = await cursor.to_list(length=100)
    return sessions

@router.post("/sessions", response_model=SessionModel)
async def create_session(session: SessionModel):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    session_dict = session.dict(by_alias=True)
    await db.sessions.insert_one(session_dict)
    return session

@router.get("/sessions/{session_id}")
async def get_session_messages(session_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    cursor = db.messages.find({"session_id": session_id}).sort("created_at", 1)
    messages = await cursor.to_list(length=1000)
    
    # Map _id safely for frontend parsing
    for msg in messages:
        msg["id"] = msg.pop("_id", None)
    
    return messages

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    await db.sessions.delete_one({"_id": session_id})
    await db.messages.delete_many({"session_id": session_id})
    
    return {"success": True, "message": "Session deleted"}
