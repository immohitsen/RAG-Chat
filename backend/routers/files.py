from fastapi import APIRouter, HTTPException
from models.schemas import FilesListResponse, IndexedFile
from services.rag_service import rag_service
import boto3
from botocore.config import Config
import os

router = APIRouter(prefix="/api", tags=["files"])

S3_BUCKET = os.getenv("S3_BUCKET", "rag-uploads-051370879738")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
s3_client = boto3.client("s3", region_name=AWS_REGION, config=Config(s3={"addressing_style": "virtual"}))

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

@router.get("/files/{filename}/download")
async def download_file(filename: str):
    """Generate a presigned S3 URL to download the original file"""
    try:
        s3_key = f"uploads/{filename}"
        url = s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": s3_key},
            ExpiresIn=300,
        )
        return {"download_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not generate download URL: {str(e)}")


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
