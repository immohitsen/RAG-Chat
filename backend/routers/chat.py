from fastapi import APIRouter, HTTPException, Depends
from models.schemas import ChatRequest, ChatResponse, Source
from services.rag_service import rag_service
from database import get_db
from models.db_models import MessageModel
from auth.dependencies import get_current_user
import time

router = APIRouter(prefix="/api", tags=["chat"])

@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user=Depends(get_current_user)):
    """
    Main RAG endpoint - Query the knowledge base

    This uses your existing src/ pipeline without modification
    """
    try:
        start_time = time.time()

        # Fetch chat history for this session
        chat_history = []
        if request.session_id:
            db = get_db()
            if db is not None:
                cursor = db.messages.find({"session_id": request.session_id}).sort("created_at", 1)
                msgs = await cursor.to_list(length=1000)
                chat_history = [{"role": m["role"], "content": m["content"]} for m in msgs]

        # Save User Message to DB immediately if session_id is provided
        if request.session_id:
            db = get_db()
            if db is not None:
                user_msg = MessageModel(
                    session_id=request.session_id,
                    role="user",
                    content=request.query
                )
                await db.messages.insert_one(user_msg.dict(by_alias=True))

        # Intent classification — chitchat goes directly to LLM, skip RAG
        intent = rag_service.classify_intent(request.query)

        if intent == "chitchat":
            answer, sources_list = rag_service.respond_direct(request.query, "chitchat", chat_history)
        else:
            selected_files = getattr(request, 'selected_files', None)
            answer, sources_list = rag_service.query(request.query, request.top_k, selected_files, chat_history, user_id=current_user["_id"])

        query_time = round(time.time() - start_time, 2)

        # Format response
        sources = [Source(**src) for src in sources_list]
        metadata = {
            "query_time": query_time,
            "chunks_used": len(sources),
            "model": "llama-3.1-8b-instant"
        }

        # Save Assistant Message to DB if session_id is provided
        if request.session_id:
            db = get_db()
            if db is not None:
                ai_msg = MessageModel(
                    session_id=request.session_id,
                    role="assistant",
                    content=answer,
                    sources=sources_list,
                    metadata=metadata
                )
                await db.messages.insert_one(ai_msg.dict(by_alias=True))

        return ChatResponse(
            answer=answer,
            sources=sources,
            metadata=metadata
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")
