"""
FastAPI Backend for RAG Pipeline
Wraps existing src/ code without modification
"""
from backend.logger import terminal_logger
terminal_logger.start()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.routers import chat, upload, health, files, logs

# Create FastAPI app
app = FastAPI(
    title="RAG Pipeline API",
    description="Production-ready API for Retrieval Augmented Generation",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# CORS - Allow React frontend to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router)
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(logs.router)


@app.get("/")
async def root():
    return {
        "message": "RAG Pipeline API",
        "docs": "/api/docs",
        "health": "/api/health"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    print("=" * 60)
    print("🚀 RAG Pipeline API Starting...")
    print("=" * 60)
    print("📚 Loading vector store...")
    # This will initialize the RAG service on startup
    from backend.services.rag_service import rag_service
    stats = rag_service.get_stats()
    print(f"✅ Vector store loaded: {stats['total_vectors']} vectors")
    print("=" * 60)
    print("API Endpoints:")
    print("  • POST /api/chat       - Query the RAG system")
    print("  • POST /api/upload     - Upload new documents")
    print("  • GET  /api/documents  - List uploaded documents")
    print("  • GET  /api/health     - Health check")
    print("  • GET  /api/docs       - Swagger UI")
    print("=" * 60)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
