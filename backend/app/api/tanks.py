from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tank import Tank
from app.simulation.data_generators import temp_to_color

router = APIRouter(prefix="/tanks", tags=["tanks"])


class TankResponse(BaseModel):
    id: int
    name: str
    material: str
    capacity_liters: float
    current_level: float
    current_volume_liters: float
    temperature_c: float
    status: str
    position_x: float
    position_y: float
    fill_pct: float
    temp_color: str


class AllocateMaterialRequest(BaseModel):
    material: str


class UpdatePositionRequest(BaseModel):
    x: float = Field(..., ge=0, le=2000)
    y: float = Field(..., ge=0, le=2000)


class TopUpRequest(BaseModel):
    target_level: float = Field(default=0.9, ge=0.1, le=1.0)


def _tank_to_response(t: Tank) -> TankResponse:
    return TankResponse(
        id=t.id,
        name=t.name,
        material=t.material,
        capacity_liters=t.capacity_liters,
        current_level=t.current_level,
        current_volume_liters=round(t.capacity_liters * t.current_level, 0),
        temperature_c=t.temperature_c,
        status=t.status,
        position_x=t.position_x,
        position_y=t.position_y,
        fill_pct=round(t.current_level * 100.0, 1),
        temp_color=temp_to_color(t.temperature_c),
    )


@router.get("", response_model=list[TankResponse])
async def list_tanks(db: AsyncSession = Depends(get_db)) -> list[TankResponse]:
    """Return all tanks."""
    tanks = (await db.execute(select(Tank).order_by(Tank.name))).scalars().all()
    return [_tank_to_response(t) for t in tanks]


@router.get("/{tank_id}", response_model=TankResponse)
async def get_tank(tank_id: int, db: AsyncSession = Depends(get_db)) -> TankResponse:
    """Return a single tank by ID."""
    result = await db.execute(select(Tank).where(Tank.id == tank_id))
    tank = result.scalar_one_or_none()
    if not tank:
        raise HTTPException(status_code=404, detail=f"Tank {tank_id} not found")
    return _tank_to_response(tank)


@router.put("/{tank_id}/allocate", response_model=TankResponse)
async def allocate_material(
    tank_id: int,
    body: AllocateMaterialRequest,
    db: AsyncSession = Depends(get_db),
) -> TankResponse:
    """Change the material allocated to a tank."""
    result = await db.execute(select(Tank).where(Tank.id == tank_id))
    tank = result.scalar_one_or_none()
    if not tank:
        raise HTTPException(status_code=404, detail=f"Tank {tank_id} not found")

    tank.material = body.material
    await db.flush()
    await db.refresh(tank)
    return _tank_to_response(tank)


@router.put("/{tank_id}/position", response_model=TankResponse)
async def update_tank_position(
    tank_id: int,
    body: UpdatePositionRequest,
    db: AsyncSession = Depends(get_db),
) -> TankResponse:
    """Update the visual position of a tank on the plant map."""
    result = await db.execute(select(Tank).where(Tank.id == tank_id))
    tank = result.scalar_one_or_none()
    if not tank:
        raise HTTPException(status_code=404, detail=f"Tank {tank_id} not found")

    tank.position_x = body.x
    tank.position_y = body.y
    await db.flush()
    await db.refresh(tank)
    return _tank_to_response(tank)


@router.post("/{tank_id}/top-up", response_model=TankResponse)
async def top_up_tank(
    tank_id: int,
    body: TopUpRequest,
    db: AsyncSession = Depends(get_db),
) -> TankResponse:
    """Simulate topping up a tank to a target fill level."""
    result = await db.execute(select(Tank).where(Tank.id == tank_id))
    tank = result.scalar_one_or_none()
    if not tank:
        raise HTTPException(status_code=404, detail=f"Tank {tank_id} not found")
    if tank.status == "offline":
        raise HTTPException(status_code=400, detail=f"Tank {tank_id} is offline")

    tank.current_level = body.target_level
    if tank.current_level > 0.20:
        tank.status = "normal"
    elif tank.current_level > 0.10:
        tank.status = "low"
    else:
        tank.status = "critical"

    await db.flush()
    await db.refresh(tank)
    return _tank_to_response(tank)
