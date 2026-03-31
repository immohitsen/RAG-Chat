from fastapi import APIRouter, HTTPException, Depends
from typing import List
from database import get_db
from models.db_models import SessionModel
from auth.dependencies import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])

@router.get("/sessions", response_model=List[SessionModel])
async def list_sessions(current_user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    cursor = db.sessions.find({"user_id": current_user["_id"]}).sort("created_at", -1)
    sessions = await cursor.to_list(length=100)
    return sessions

@router.post("/sessions", response_model=SessionModel)
async def create_session(session: SessionModel, current_user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    session_dict = session.model_dump(by_alias=True)
    session_dict["user_id"] = current_user["_id"]
    await db.sessions.insert_one(session_dict)
    return session_dict

@router.get("/sessions/{session_id}")
async def get_session_messages(session_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    session = await db.sessions.find_one({"_id": session_id})
    if not session or session.get("user_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    cursor = db.messages.find({"session_id": session_id}).sort("created_at", 1)
    messages = await cursor.to_list(length=1000)

    for msg in messages:
        msg["id"] = msg.pop("_id", None)

    return messages

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, current_user=Depends(get_current_user)):
    db = get_db()
    if db is None:
        raise HTTPException(status_code=500, detail="Database not connected")

    session = await db.sessions.find_one({"_id": session_id})
    if not session or session.get("user_id") != current_user["_id"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.sessions.delete_one({"_id": session_id})
    await db.messages.delete_many({"session_id": session_id})

    return {"success": True, "message": "Session deleted"}
