from fastapi import APIRouter
from models.schemas import HealthResponse
from services.rag_service import rag_service

router = APIRouter(prefix="/api", tags=["health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the RAG system is healthy and loaded"""
    stats = rag_service.get_stats()

    return HealthResponse(
        status="healthy",
        vector_store_loaded=stats["loaded"],
        total_vectors=stats["total_vectors"]
    )
