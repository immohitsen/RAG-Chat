from pydantic import BaseModel, Field
from typing import List, Optional

class ChatRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User's question")
    top_k: int = Field(default=3, ge=1, le=10, description="Number of relevant chunks to retrieve")
    selected_files: Optional[List[str]] = Field(default=None, description="Filter search to specific files")

class Source(BaseModel):
    file: str
    page: Optional[int] = None
    snippet: str
    confidence: float

class ChatResponse(BaseModel):
    answer: str
    sources: List[Source]
    metadata: dict

class UploadResponse(BaseModel):
    success: bool
    message: str
    filename: str
    chunks_added: Optional[int] = None

class HealthResponse(BaseModel):
    status: str
    vector_store_loaded: bool
    total_vectors: int

class IndexedFile(BaseModel):
    filename: str
    full_path: str
    chunk_count: int

class FilesListResponse(BaseModel):
    files: List[IndexedFile]
    total_files: int
