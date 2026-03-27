from fastapi import APIRouter, HTTPException
from models.schemas import ChatRequest, ChatResponse, Source
from services.rag_service import rag_service
from database import get_db
from models.db_models import MessageModel
import time

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Main RAG endpoint - Query the knowledge base

    This uses your existing src/ pipeline without modification
    """
    try:
        start_time = time.time()

        # Call RAG pipeline with optional file filtering
        selected_files = getattr(request, 'selected_files', None)
        answer, sources_list = rag_service.query(request.query, request.top_k, selected_files)

        query_time = round(time.time() - start_time, 2)

        # Format response
        sources = [Source(**src) for src in sources_list]
        metadata = {
            "query_time": query_time,
            "chunks_used": len(sources),
            "model": "llama-3.1-8b-instant"
        }

        # Save to DB if session_id is provided
        if request.session_id:
            db = get_db()
            if db is not None:
                # 1. User Message
                user_msg = MessageModel(
                    session_id=request.session_id,
                    role="user",
                    content=request.query
                )
                # 2. Assistant Message
                ai_msg = MessageModel(
                    session_id=request.session_id,
                    role="assistant",
                    content=answer,
                    sources=sources_list,
                    metadata=metadata
                )
                await db.messages.insert_many([
                    user_msg.dict(by_alias=True),
                    ai_msg.dict(by_alias=True)
                ])

        return ChatResponse(
            answer=answer,
            sources=sources,
            metadata=metadata
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")
