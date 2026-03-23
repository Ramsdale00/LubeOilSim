from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.blend_batch import BlendBatch
from app.models.event_log import EventLog
from app.simulation.data_generators import generate_energy_heatmap, generate_kpi_snapshot

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


class KPIResponse(BaseModel):
    production_volume_liters: float
    cost_per_batch: float
    energy_kwh: float
    utilization_pct: float
    batches_today: int
    batches_mixing: int
    on_spec_rate: float
    tank_fill_pct: float
    active_alerts: int
    timestamp: str


class EventResponse(BaseModel):
    id: int
    timestamp: str
    severity: str
    category: str
    message: str
    resolved: bool


class TimelineEntryResponse(BaseModel):
    batch_id: str
    stage: str
    progress_pct: float
    started_at: Optional[str]
    completed_at: Optional[str]
    volume_liters: float


class EnergyHeatmapResponse(BaseModel):
    hours: list[int]
    equipment: list[str]
    data: list[list[float]]


@router.get("/kpis", response_model=KPIResponse)
async def get_kpis(db: AsyncSession = Depends(get_db)) -> KPIResponse:
    """Return current KPI snapshot."""
    from app.models.tank import Tank
    from app.models.equipment import Equipment

    batches = (await db.execute(select(BlendBatch))).scalars().all()
    tanks = (await db.execute(select(Tank))).scalars().all()
    equipment = (await db.execute(select(Equipment))).scalars().all()

    batch_dicts = [
        {"stage": b.stage, "volume_liters": b.volume_liters, "progress_pct": b.progress_pct, "alerts": b.alerts or []}
        for b in batches
    ]
    tank_dicts = [
        {"capacity_liters": t.capacity_liters, "current_level": t.current_level}
        for t in tanks
    ]
    equip_dicts = [{"status": e.status} for e in equipment]

    kpis = generate_kpi_snapshot(batch_dicts, tank_dicts, equip_dicts)
    kpis["timestamp"] = datetime.now(timezone.utc).isoformat()
    return KPIResponse(**kpis)


@router.get("/events", response_model=list[EventResponse])
async def get_events(
    severity: Optional[str] = Query(None, description="Filter by severity: info/warning/critical"),
    db: AsyncSession = Depends(get_db),
) -> list[EventResponse]:
    """Return last 100 event logs, optionally filtered by severity."""
    stmt = select(EventLog).order_by(desc(EventLog.timestamp)).limit(100)
    if severity:
        stmt = stmt.where(EventLog.severity == severity)
    events = (await db.execute(stmt)).scalars().all()

    return [
        EventResponse(
            id=e.id,
            timestamp=e.timestamp.isoformat() if e.timestamp else datetime.now(timezone.utc).isoformat(),
            severity=e.severity,
            category=e.category,
            message=e.message,
            resolved=e.resolved,
        )
        for e in events
    ]


@router.get("/timeline", response_model=list[TimelineEntryResponse])
async def get_timeline(db: AsyncSession = Depends(get_db)) -> list[TimelineEntryResponse]:
    """Return timeline of batch operations in the last 24 hours."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    stmt = (
        select(BlendBatch)
        .where(
            (BlendBatch.started_at >= cutoff) | (BlendBatch.stage.in_(["queued", "mixing", "sampling", "lab"]))
        )
        .order_by(BlendBatch.started_at.desc())
    )
    batches = (await db.execute(stmt)).scalars().all()

    return [
        TimelineEntryResponse(
            batch_id=b.batch_id,
            stage=b.stage,
            progress_pct=b.progress_pct,
            started_at=b.started_at.isoformat() if b.started_at else None,
            completed_at=b.completed_at.isoformat() if b.completed_at else None,
            volume_liters=b.volume_liters,
        )
        for b in batches
    ]


@router.get("/energy-heatmap", response_model=EnergyHeatmapResponse)
async def get_energy_heatmap() -> EnergyHeatmapResponse:
    """Return 24h × 8 equipment energy consumption heatmap."""
    data = generate_energy_heatmap()
    return EnergyHeatmapResponse(
        hours=list(range(24)),
        equipment=[
            "Blender B1", "Blender B2", "Blender B3",
            "Pump P-01", "Pump P-02",
            "Heat Exchanger HX-1", "Filtration Unit F-1", "Mixing Tank MT-1",
        ],
        data=data,
    )
