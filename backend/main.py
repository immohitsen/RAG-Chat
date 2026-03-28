"""
FastAPI Backend for RAG Pipeline
Wraps existing src/ code without modification
"""
from logger import terminal_logger
terminal_logger.start()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import chat, upload, health, files, logs, history
from database import connect_to_mongo, close_mongo_connection

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
    allow_origins=["*"], # Allow all for easier cloud deployment
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
app.include_router(history.router)

@app.get("/")
async def root():
    return {
        "message": "RAG Pipeline API (MongoDB Atlas Vector Search)",
        "docs": "/api/docs",
        "health": "/api/health"
    }

# Startup event
@app.on_event("startup")
async def startup_event():
    await connect_to_mongo()
    print("=" * 60)
    print("🚀 RAG Pipeline API Starting (MongoDB Atlas)...")
    print("=" * 60)
    # RAG service is a singleton, it will connect to Mongo on first access
    from services.rag_service import rag_service
    stats = rag_service.get_stats()
    print(f"✅ MongoDB Vector store connected: {stats['total_vectors']} chunks")
    print("=" * 60)

@app.on_event("shutdown")
async def shutdown_event():
    await close_mongo_connection()

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
