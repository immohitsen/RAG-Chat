from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from models.schemas import UploadResponse
from services.rag_service import rag_service
from pathlib import Path
import os
import tempfile

router = APIRouter(prefix="/api", tags=["upload"])

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".csv", ".xlsx", ".docx", ".json"}

# Automatically detect environment: AWS Lambda sets this env var
IS_LOCAL = not bool(os.getenv("AWS_LAMBDA_FUNCTION_NAME"))
LOCAL_UPLOAD_DIR = "data/uploaded"

if not IS_LOCAL:
    import boto3
    from botocore.config import Config
    S3_BUCKET = os.getenv("S3_BUCKET", "rag-uploads-051370879738")
    AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
    s3_client = boto3.client(
        "s3",
        region_name=AWS_REGION,
        config=Config(s3={"addressing_style": "virtual"}),
    )


class PresignedUrlRequest(BaseModel):
    filename: str
    content_type: str = "application/octet-stream"


class ProcessRequest(BaseModel):
    s3_key: str
    filename: str


@router.post("/upload/presigned-url")
async def get_presigned_url(req: PresignedUrlRequest):
    """Get a presigned S3 URL for direct frontend upload (AWS), or signal local upload"""
    file_ext = Path(req.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file_ext} not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    if IS_LOCAL:
        return {"upload_url": None, "s3_key": None, "use_local": True}

    s3_key = f"uploads/{req.filename}"
    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={"Bucket": S3_BUCKET, "Key": s3_key},
        ExpiresIn=300,
    )
    return {"upload_url": presigned_url, "s3_key": s3_key, "use_local": False}

## new endpoint for local file upload (bypassing S3) for development convenience
@router.post("/upload/local")
async def upload_local_file(file: UploadFile = File(...)):
    """Direct file upload for local development (no S3)"""
    os.makedirs(LOCAL_UPLOAD_DIR, exist_ok=True)
    local_path = os.path.join(LOCAL_UPLOAD_DIR, file.filename)
    content = await file.read()
    with open(local_path, "wb") as f:
        f.write(content)
    return {"s3_key": f"local://{local_path}", "filename": file.filename}


# This endpoint processes the uploaded file - either from local path or S3 - and adds it to MongoDB Atlas
@router.post("/upload/process", response_model=UploadResponse)
async def process_uploaded_file(req: ProcessRequest):
    """Process uploaded file - reads from local path or downloads from S3"""
    try:
        from logger import terminal_logger
        terminal_logger.clear()

        if req.s3_key.startswith("local://"):
            tmp_path = req.s3_key.replace("local://", "")
            chunks_added = rag_service.add_document(tmp_path)
            os.unlink(tmp_path)
        else:
            tmp_dir = tempfile.mkdtemp()
            tmp_path = os.path.join(tmp_dir, req.filename)
            with open(tmp_path, "wb") as f:
                s3_client.download_fileobj(S3_BUCKET, req.s3_key, f)
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
