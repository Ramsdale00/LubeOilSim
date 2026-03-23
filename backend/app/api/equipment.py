from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.equipment import Equipment
from app.simulation.data_generators import (
    interpolate_time_series,
    generate_maintenance_prediction,
)

router = APIRouter(prefix="/equipment", tags=["equipment"])


class EquipmentResponse(BaseModel):
    id: int
    name: str
    type: str
    health_pct: float
    status: str
    last_maintenance: Optional[str]
    next_maintenance_due: Optional[str]


class HealthHistoryPoint(BaseModel):
    timestamp: str
    value: float


class EquipmentHealthHistoryResponse(BaseModel):
    equipment_id: int
    equipment_name: str
    history: list[HealthHistoryPoint]


class MaintenanceAlertResponse(BaseModel):
    equipment_id: int
    equipment_name: str
    health_pct: float
    status: str
    days_to_failure: float
    confidence: float
    risk_level: str
    recommended_action: str
    next_maintenance_due: Optional[str]


def _equip_to_response(e: Equipment) -> EquipmentResponse:
    return EquipmentResponse(
        id=e.id,
        name=e.name,
        type=e.type,
        health_pct=e.health_pct,
        status=e.status,
        last_maintenance=e.last_maintenance.isoformat() if e.last_maintenance else None,
        next_maintenance_due=e.next_maintenance_due.isoformat() if e.next_maintenance_due else None,
    )


@router.get("", response_model=list[EquipmentResponse])
async def list_equipment(db: AsyncSession = Depends(get_db)) -> list[EquipmentResponse]:
    """Return all equipment."""
    equipment = (await db.execute(select(Equipment).order_by(Equipment.name))).scalars().all()
    return [_equip_to_response(e) for e in equipment]


@router.get("/{equipment_id}/health-history", response_model=EquipmentHealthHistoryResponse)
async def get_health_history(
    equipment_id: int,
    db: AsyncSession = Depends(get_db),
) -> EquipmentHealthHistoryResponse:
    """Return simulated health time series for an equipment item."""
    result = await db.execute(select(Equipment).where(Equipment.id == equipment_id))
    equip = result.scalar_one_or_none()
    if not equip:
        raise HTTPException(status_code=404, detail=f"Equipment {equipment_id} not found")

    # Generate historical health series — slight downward drift
    series = interpolate_time_series(
        base=min(equip.health_pct + 5.0, 100.0),
        noise_scale=1.0,
        points=48,
    )
    # Apply a small downward trend to simulate degradation
    for i, pt in enumerate(series):
        drift = i * 0.05
        pt["value"] = round(max(0.0, pt["value"] - drift), 2)

    return EquipmentHealthHistoryResponse(
        equipment_id=equip.id,
        equipment_name=equip.name,
        history=[HealthHistoryPoint(**p) for p in series],
    )


@router.get("/maintenance-alerts", response_model=list[MaintenanceAlertResponse])
async def get_maintenance_alerts(db: AsyncSession = Depends(get_db)) -> list[MaintenanceAlertResponse]:
    """Return predictive maintenance alerts for all equipment."""
    equipment = (await db.execute(select(Equipment).order_by(Equipment.health_pct))).scalars().all()

    alerts = []
    for e in equipment:
        equip_dict = {
            "id": e.id,
            "name": e.name,
            "health_pct": e.health_pct,
            "status": e.status,
        }
        prediction = generate_maintenance_prediction(equip_dict)
        alerts.append(MaintenanceAlertResponse(
            equipment_id=e.id,
            equipment_name=e.name,
            health_pct=e.health_pct,
            status=e.status,
            days_to_failure=prediction["days_to_failure"],
            confidence=prediction["confidence"],
            risk_level=prediction["risk_level"],
            recommended_action=prediction["recommended_action"],
            next_maintenance_due=e.next_maintenance_due.isoformat() if e.next_maintenance_due else None,
        ))

    # Sort: critical first
    level_order = {"critical": 0, "warning": 1, "normal": 2}
    alerts.sort(key=lambda a: level_order.get(a.risk_level, 3))

    return alerts
