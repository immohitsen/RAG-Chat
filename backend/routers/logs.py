from fastapi import APIRouter
from logger import terminal_logger

router = APIRouter(prefix="/api/logs", tags=["logs"])

@router.get("/")
async def get_logs():
    return {"logs": terminal_logger.get_logs()}
