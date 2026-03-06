from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Optional

from app.agents.popo import PopoAgent
from app.agents.pappy import PappyAgent
from app.api import deps
from app.models.user import User

router = APIRouter()

class PopoRequest(BaseModel):
    text: str
    history: List[Dict] = []
    topic: str
    module_title: str
    provider: Optional[str] = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None

class PappyRequest(BaseModel):
    topic: str
    module_title: str
    module_content: str
    history: List[Dict] = []
    provider: Optional[str] = "ollama"
    model: Optional[str] = None
    api_key: Optional[str] = None

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",   # Disable nginx/proxy buffering
    "Connection": "keep-alive",
}


@router.post("/popo/ask/stream")
async def popo_ask_stream(
    payload: PopoRequest,
    current_user: User = Depends(deps.get_current_user)
):
    agent = PopoAgent(
        provider=payload.provider,
        model=payload.model,
        api_key=payload.api_key
    )
    return StreamingResponse(
        agent.chat_stream(
            text=payload.text,
            history=payload.history,
            topic=payload.topic,
            module_title=payload.module_title,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )

@router.post("/pappy/chat/stream")
async def pappy_chat_stream(
    payload: PappyRequest,
    current_user: User = Depends(deps.get_current_user)
):
    agent = PappyAgent(
        provider=payload.provider,
        model=payload.model,
        api_key=payload.api_key
    )
    return StreamingResponse(
        agent.chat_stream(
            topic=payload.topic,
            module_title=payload.module_title,
            module_content=payload.module_content,
            history=payload.history,
        ),
        media_type="text/event-stream",
        headers=SSE_HEADERS,
    )
