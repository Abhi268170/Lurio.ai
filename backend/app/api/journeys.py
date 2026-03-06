from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.db.session import get_db
from app.models.journey import Journey, JourneyNode
from app.models.course import Course
from app import schemas
from app.api import deps
from app.models.user import User

router = APIRouter()

@router.get("/", response_model=List[schemas.Journey])
async def read_journeys(
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(
        select(Journey)
        .where(Journey.owner_id == current_user.id)
        .offset(skip).limit(limit).order_by(Journey.id.desc())
    )
    return result.scalars().all()

@router.post("/", response_model=schemas.JourneyWithNodes)
async def create_journey(
    journey_in: schemas.JourneyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    journey = Journey(
        topic=journey_in.topic,
        owner_id=current_user.id
    )
    db.add(journey)
    await db.commit()
    await db.refresh(journey)

    root_node = JourneyNode(
        journey_id=journey.id,
        topic=journey.topic,
        status="completed",
        is_discovered=False
    )
    db.add(root_node)
    await db.commit()
    await db.refresh(root_node)

    await db.refresh(journey, ['nodes'])
    return journey

@router.get("/{id}", response_model=schemas.JourneyWithNodes)
async def read_journey(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    result = await db.execute(
        select(Journey).options(selectinload(Journey.nodes))
        .where(Journey.id == id, Journey.owner_id == current_user.id)
    )
    journey = result.scalar_one_or_none()
    if not journey:
        raise HTTPException(status_code=404, detail="Journey not found")
    return journey

@router.post("/nodes/{node_id}/explore", response_model=List[schemas.JourneyNode])
async def explore_node(
    node_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    # Verify ownership via journey 
    node_res = await db.execute(select(JourneyNode).options(selectinload(JourneyNode.journey)).where(JourneyNode.id == node_id))
    node = node_res.scalar_one_or_none()
    if not node or node.journey.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Node not found")

    if not node.is_discovered:
        node.is_discovered = True
        await db.commit()

    from app.agents.architect import ArchitectAgent
    import json, re
    # We ask architect to generate subtopics using system default groq settings
    agent = ArchitectAgent(
        provider="groq",
        model=settings.GROQ_MODEL,
        api_key=settings.GROQ_API_KEY
    )
    prompt = f"Break down the topic '{node.topic}' into 3 or 4 actionable sub-topics to learn next. Return ONLY a JSON array of strings."
    res = await agent.generate_content(prompt)
    try:
        match = re.search(r'\[.*?\]', res, re.DOTALL)
        if match: sub_topics = json.loads(match.group())
        else: sub_topics = json.loads(res.strip())
    except:
        sub_topics = [f"Sub-topic of {node.topic} 1", f"Sub-topic of {node.topic} 2"]

    new_nodes = []
    for t in sub_topics[:4]:
        child = JourneyNode(
            journey_id=node.journey_id,
            topic=t,
            parent_id=node.id,
            status="pending",
            is_discovered=False
        )
        db.add(child)
        new_nodes.append(child)
    
    await db.commit()
    for child in new_nodes:
        await db.refresh(child)
    
    return new_nodes

@router.post("/nodes/{node_id}/create-course", response_model=schemas.JourneyNode)
async def create_node_course(
    node_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    node_res = await db.execute(select(JourneyNode).options(selectinload(JourneyNode.journey)).where(JourneyNode.id == node_id))
    node = node_res.scalar_one_or_none()
    if not node or node.journey.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Node not found")

    course = Course(
        topic=node.topic,
        title=node.topic,
        difficulty="intermediate",
        provider="groq",
        model=settings.GROQ_MODEL,
        owner_id=current_user.id,
        status="PENDING"
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)

    node.course_id = course.id
    node.status = "generating"
    await db.commit()
    await db.refresh(node)

    from app.tasks.course_tasks import generate_course_content
    generate_course_content.delay(course.id)

    return node
