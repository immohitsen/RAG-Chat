from fastapi import APIRouter, UploadFile, File, HTTPException
from models.schemas import UploadResponse
from services.rag_service import rag_service
import shutil
from pathlib import Path

router = APIRouter(prefix="/api", tags=["upload"])

# Supported file extensions
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".csv", ".xlsx", ".docx", ".json"}

@router.post("/upload", response_model=UploadResponse)
async def upload_document(file: UploadFile = File(...)):
    """
    Upload a new document and add it to the vector store

    Supports: PDF, TXT, CSV, Excel, Word, JSON
    """
    try:
        # Validate file extension
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file_ext} not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        # Save uploaded file to backend/data/uploaded/
        upload_dir = Path("backend/data/uploaded")
        upload_dir.mkdir(parents=True, exist_ok=True)

        file_path = upload_dir / file.filename

        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        print(f"[Upload] Saved file to: {file_path}")

        # Clear logs before processing this file so frontend gets fresh logs
        from logger import terminal_logger
        terminal_logger.clear()

        # Add to vector store using your existing pipeline
        chunks_added = rag_service.add_document(str(file_path))

        return UploadResponse(
            success=True,
            message=f"Successfully uploaded and indexed {file.filename}",
            filename=file.filename,
            chunks_added=chunks_added
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/documents")
async def list_documents():
    """List all uploaded documents"""
    upload_dir = Path("backend/data/uploaded")
    if not upload_dir.exists():
        return {"documents": []}

    documents = [
        {
            "filename": f.name,
            "size": f.stat().st_size,
            "uploaded_at": f.stat().st_mtime
        }
        for f in upload_dir.iterdir()
        if f.is_file()
    ]

    return {"documents": documents}
