from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

# Helper for Optional ObjectId
def generate_uuid() -> str:
    return str(uuid.uuid4())

class SessionModel(BaseModel):
    id: str = Field(default_factory=generate_uuid, alias="_id")
    title: str = Field(..., description="Auto-generated title from first query")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        alias_generator = lambda string: "_id" if string == "id" else string

class MessageModel(BaseModel):
    id: str = Field(default_factory=generate_uuid, alias="_id")
    session_id: str = Field(..., description="ID of the session this message belongs to")
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="The message text")
    sources: Optional[List[Dict[str, Any]]] = Field(default=[], description="List of source citations")
    metadata: Optional[Dict[str, Any]] = Field(default={}, description="Query time, tokens, etc.")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
        alias_generator = lambda string: "_id" if string == "id" else string
