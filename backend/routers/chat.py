from fastapi import APIRouter, HTTPException
from backend.models.schemas import ChatRequest, ChatResponse, Source
from backend.services.rag_service import rag_service
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

        return ChatResponse(
            answer=answer,
            sources=sources,
            metadata={
                "query_time": query_time,
                "chunks_used": len(sources),
                "model": "llama-3.1-8b-instant"
            }
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"RAG query failed: {str(e)}")
