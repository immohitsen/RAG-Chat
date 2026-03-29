from fastapi import APIRouter, HTTPException
from models.schemas import FilesListResponse, IndexedFile
from services.rag_service import rag_service

router = APIRouter(prefix="/api", tags=["files"])

@router.get("/files", response_model=FilesListResponse)
async def get_indexed_files():
    """
    Get list of all indexed files in the vector store
    """
    files = rag_service.get_indexed_files()

    return FilesListResponse(
        files=[IndexedFile(**f) for f in files],
        total_files=len(files)
    )

@router.delete("/files/{filename:path}")
async def delete_file(filename: str):
    """
    Delete a file from the vector store
    """
    try:
        chunks_removed = rag_service.delete_file(filename)
        return {
            "success": True,
            "message": f"Deleted {filename}",
            "chunks_removed": chunks_removed
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")
