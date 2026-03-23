from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.blend_batch import BlendBatch

router = APIRouter(prefix="/blends", tags=["blends"])


class BlendBatchResponse(BaseModel):
    id: int
    batch_id: str
    recipe_id: Optional[int]
    stage: str
    temperature_c: float
    mixing_speed_rpm: float
    progress_pct: float
    volume_liters: float
    alerts: list[str]
    started_at: Optional[str]
    completed_at: Optional[str]
    created_at: Optional[str]


class CreateBlendRequest(BaseModel):
    recipe_id: Optional[int] = None
    volume_liters: float = Field(default=10000.0, ge=1000.0, le=100000.0)
    temperature_c: float = Field(default=75.0, ge=40.0, le=120.0)
    mixing_speed_rpm: float = Field(default=120.0, ge=20.0, le=300.0)


class UpdateBlendParametersRequest(BaseModel):
    temperature_c: Optional[float] = Field(None, ge=40.0, le=120.0)
    mixing_speed_rpm: Optional[float] = Field(None, ge=20.0, le=300.0)


class BlendProgressResponse(BaseModel):
    batch_id: str
    stage: str
    progress_pct: float
    temperature_c: float
    mixing_speed_rpm: float
    alerts: list[str]
    estimated_minutes_remaining: Optional[float]


class PaginatedBlendsResponse(BaseModel):
    items: list[BlendBatchResponse]
    total: int
    page: int
    page_size: int


def _batch_to_response(b: BlendBatch) -> BlendBatchResponse:
    return BlendBatchResponse(
        id=b.id,
        batch_id=b.batch_id,
        recipe_id=b.recipe_id,
        stage=b.stage,
        temperature_c=b.temperature_c,
        mixing_speed_rpm=b.mixing_speed_rpm,
        progress_pct=b.progress_pct,
        volume_liters=b.volume_liters,
        alerts=b.alerts or [],
        started_at=b.started_at.isoformat() if b.started_at else None,
        completed_at=b.completed_at.isoformat() if b.completed_at else None,
        created_at=b.created_at.isoformat() if b.created_at else None,
    )


@router.get("", response_model=PaginatedBlendsResponse)
async def list_blends(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    stage: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> PaginatedBlendsResponse:
    """List blend batches with pagination."""
    stmt = select(BlendBatch).order_by(BlendBatch.id.desc())
    if stage:
        stmt = stmt.where(BlendBatch.stage == stage)

    count_stmt = select(func.count()).select_from(BlendBatch)
    if stage:
        count_stmt = count_stmt.where(BlendBatch.stage == stage)

    total = (await db.execute(count_stmt)).scalar() or 0
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    batches = (await db.execute(stmt)).scalars().all()

    return PaginatedBlendsResponse(
        items=[_batch_to_response(b) for b in batches],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{batch_id}", response_model=BlendBatchResponse)
async def get_blend(batch_id: str, db: AsyncSession = Depends(get_db)) -> BlendBatchResponse:
    """Get a single blend batch by batch_id."""
    result = await db.execute(select(BlendBatch).where(BlendBatch.batch_id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Blend batch '{batch_id}' not found")
    return _batch_to_response(batch)


@router.post("", response_model=BlendBatchResponse, status_code=201)
async def create_blend(
    body: CreateBlendRequest, db: AsyncSession = Depends(get_db)
) -> BlendBatchResponse:
    """Create a new blend batch."""
    count_result = await db.execute(select(func.count()).select_from(BlendBatch))
    count = (count_result.scalar() or 0) + 1
    new_batch_id = f"B-{datetime.now(timezone.utc).year}-{count:03d}"

    # Ensure uniqueness
    existing = await db.execute(select(BlendBatch).where(BlendBatch.batch_id == new_batch_id))
    if existing.scalar_one_or_none():
        import random
        new_batch_id = f"B-{datetime.now(timezone.utc).year}-{count:03d}-{random.randint(10, 99)}"

    batch = BlendBatch(
        batch_id=new_batch_id,
        recipe_id=body.recipe_id,
        stage="queued",
        temperature_c=body.temperature_c,
        mixing_speed_rpm=body.mixing_speed_rpm,
        progress_pct=0.0,
        volume_liters=body.volume_liters,
        alerts=[],
    )
    db.add(batch)
    await db.flush()
    await db.refresh(batch)
    return _batch_to_response(batch)


@router.put("/{batch_id}/start", response_model=BlendBatchResponse)
async def start_blend(batch_id: str, db: AsyncSession = Depends(get_db)) -> BlendBatchResponse:
    """Start a queued blend batch."""
    result = await db.execute(select(BlendBatch).where(BlendBatch.batch_id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Blend batch '{batch_id}' not found")
    if batch.stage not in ("queued", "failed"):
        raise HTTPException(status_code=400, detail=f"Batch '{batch_id}' is already {batch.stage}")

    batch.stage = "mixing"
    batch.progress_pct = 0.0
    batch.started_at = datetime.now(timezone.utc)
    batch.completed_at = None
    batch.alerts = []
    await db.flush()
    await db.refresh(batch)
    return _batch_to_response(batch)


@router.put("/{batch_id}/stop", response_model=BlendBatchResponse)
async def stop_blend(batch_id: str, db: AsyncSession = Depends(get_db)) -> BlendBatchResponse:
    """Stop an active blend batch."""
    result = await db.execute(select(BlendBatch).where(BlendBatch.batch_id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Blend batch '{batch_id}' not found")
    if batch.stage not in ("mixing", "sampling", "lab"):
        raise HTTPException(status_code=400, detail=f"Batch '{batch_id}' cannot be stopped at stage: {batch.stage}")

    batch.stage = "failed"
    batch.completed_at = datetime.now(timezone.utc)
    alerts = list(batch.alerts or [])
    alerts.append("Batch manually stopped by operator")
    batch.alerts = alerts
    await db.flush()
    await db.refresh(batch)
    return _batch_to_response(batch)


@router.put("/{batch_id}/parameters", response_model=BlendBatchResponse)
async def update_blend_parameters(
    batch_id: str,
    body: UpdateBlendParametersRequest,
    db: AsyncSession = Depends(get_db),
) -> BlendBatchResponse:
    """Update temperature and/or mixing speed for an active blend."""
    result = await db.execute(select(BlendBatch).where(BlendBatch.batch_id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Blend batch '{batch_id}' not found")
    if batch.stage not in ("mixing", "sampling"):
        raise HTTPException(status_code=400, detail=f"Cannot update parameters at stage: {batch.stage}")

    if body.temperature_c is not None:
        batch.temperature_c = body.temperature_c
    if body.mixing_speed_rpm is not None:
        batch.mixing_speed_rpm = body.mixing_speed_rpm

    await db.flush()
    await db.refresh(batch)
    return _batch_to_response(batch)


@router.get("/{batch_id}/progress", response_model=BlendProgressResponse)
async def get_blend_progress(
    batch_id: str, db: AsyncSession = Depends(get_db)
) -> BlendProgressResponse:
    """Get real-time progress for a blend batch."""
    result = await db.execute(select(BlendBatch).where(BlendBatch.batch_id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Blend batch '{batch_id}' not found")

    # Estimate remaining time based on progress and typical rate
    estimated_minutes = None
    if batch.stage in ("mixing", "sampling", "lab") and batch.progress_pct < 100.0:
        remaining_pct = 100.0 - batch.progress_pct
        # Approx 2% per tick, 2s per tick
        ticks_remaining = remaining_pct / 2.0
        estimated_minutes = round(ticks_remaining * 2.0 / 60.0, 1)

    return BlendProgressResponse(
        batch_id=batch.batch_id,
        stage=batch.stage,
        progress_pct=batch.progress_pct,
        temperature_c=batch.temperature_c,
        mixing_speed_rpm=batch.mixing_speed_rpm,
        alerts=batch.alerts or [],
        estimated_minutes_remaining=estimated_minutes,
    )
