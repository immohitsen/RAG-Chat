from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models.schemas import UploadResponse
from services.rag_service import rag_service
from pathlib import Path
import boto3
import os
import tempfile

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".csv", ".xlsx", ".docx", ".json"}
S3_BUCKET = os.getenv("S3_BUCKET", "rag-uploads-051370879738")
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")

s3_client = boto3.client("s3", region_name=AWS_REGION)


class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


class ProcessRequest(BaseModel):
    s3_key: str
    filename: str


@router.post("/upload/presigned-url")
async def get_presigned_url(req: PresignedUrlRequest):
    """Get a presigned S3 URL for direct frontend upload"""
    file_ext = Path(req.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file_ext} not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    s3_key = f"uploads/{req.filename}"

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key, "ContentType": req.content_type},
        ExpiresIn=300,
    )

    return {"upload_url": presigned_url, "s3_key": s3_key}


@router.post("/upload/process", response_model=UploadResponse)
async def process_uploaded_file(req: ProcessRequest):
    """Download file from S3 and add to vector store"""
    try:
        with tempfile.NamedTemporaryFile(
            suffix=Path(req.filename).suffix, delete=False
        ) as tmp:
            s3_client.download_fileobj(S3_BUCKET, req.s3_key, tmp)
            tmp_path = tmp.name

        from logger import terminal_logger
        terminal_logger.clear()

        chunks_added = rag_service.add_document(tmp_path)

        os.unlink(tmp_path)

        return UploadResponse(
            success=True,
            message=f"Successfully uploaded and indexed {req.filename}",
            filename=req.filename,
            chunks_added=chunks_added,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


@router.get("/documents")
async def list_documents():
    """List all uploaded documents from vector store"""
    files = rag_service.get_indexed_files()
    return {"documents": files}
