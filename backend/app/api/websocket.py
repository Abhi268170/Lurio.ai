import asyncio
import json
import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.future import select

from app.db.session import SessionLocal
from app.core.config import settings
from app.models.course import Course, CourseModule

router = APIRouter()


@router.websocket("/ws/courses/{course_id}")
async def course_websocket(
    websocket: WebSocket,
    course_id: int,
):
    """
    WebSocket endpoint for real-time course generation updates.

    Runs two concurrent tasks:
    1. poll_db   — sends status snapshots every 2s (course status, module list with content)
    2. listen_redis — forwards streaming content chunks published by the Celery worker
    """
    await websocket.accept()

    redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    pubsub = redis_client.pubsub()
    channel = f"course:{course_id}:stream"
    await pubsub.subscribe(channel)

    stop_event = asyncio.Event()

    async def poll_db():
        while not stop_event.is_set():
            try:
                async with SessionLocal() as db:
                    result = await db.execute(select(Course).where(Course.id == course_id))
                    course = result.scalar_one_or_none()
                    if not course:
                        await websocket.send_json({"type": "error", "message": "Course not found"})
                        stop_event.set()
                        return

                    modules_result = await db.execute(
                        select(CourseModule)
                        .where(CourseModule.course_id == course_id)
                        .order_by(CourseModule.order)
                    )
                    modules = modules_result.scalars().all()
                    modules_data = [
                        {
                            "id": m.id,
                            "title": m.title,
                            "status": m.status.lower() if m.status else m.status,
                            "order": m.order,
                            "is_completed_by_user": m.is_completed_by_user,
                            "content": m.content,
                            "audio_status": m.audio_status,
                            "notes": m.notes,
                        }
                        for m in modules
                    ]

                    await websocket.send_json({
                        "type": "status_update",
                        "course_status": course.status,
                        "podcast_status": course.podcast_status,
                        "modules": modules_data,
                    })

                    course_done = course.status in ("COMPLETED", "FAILED")
                    podcast_done = (
                        course.podcast_status in ("completed", "failed")
                        or course.podcast_status is None
                    )
                    audio_generating = any(
                        m.audio_status == "generating" for m in modules
                    )
                    modules_regenerating = any(
                        m.status and m.status.value == "GENERATING" for m in modules
                    )

                    if course_done and podcast_done and not audio_generating and not modules_regenerating:
                        await websocket.send_json({"type": "course_complete", "status": course.status})
                        stop_event.set()
                        return

            except WebSocketDisconnect:
                stop_event.set()
                return
            except Exception as e:
                try:
                    await websocket.send_json({"type": "error", "message": str(e)})
                except Exception:
                    pass
                stop_event.set()
                return

            await asyncio.sleep(2)

    async def listen_redis():
        """Forward streaming chunks published by the Celery worker."""
        while not stop_event.is_set():
            try:
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=0.5
                )
                if message and message["type"] == "message":
                    data = json.loads(message["data"])
                    await websocket.send_json(data)
            except WebSocketDisconnect:
                stop_event.set()
                return
            except Exception:
                # Ignore transient parse / send errors; keep listening
                pass

    db_task = asyncio.create_task(poll_db())
    redis_task = asyncio.create_task(listen_redis())

    try:
        await asyncio.gather(db_task, redis_task)
    except Exception:
        pass
    finally:
        stop_event.set()
        db_task.cancel()
        redis_task.cancel()
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        await redis_client.aclose()
