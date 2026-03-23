from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

router = APIRouter(prefix="/simulation", tags=["simulation"])


class InjectEventRequest(BaseModel):
    event_type: str = Field(..., pattern="^(equipment_failure|material_shortage|quality_deviation)$")
    target_id: int | None = None


class TimeAccelerationRequest(BaseModel):
    factor: int = Field(..., ge=1, le=10)


class SimulationStatusResponse(BaseModel):
    is_running: bool
    tick_count: int
    time_acceleration: int
    active_batches: int
    critical_tanks: int
    failed_equipment: int
    timestamp: str


@router.post("/inject-event")
async def inject_event(body: InjectEventRequest, request: Request) -> dict:
    """Inject a simulation event (equipment failure, material shortage, quality deviation)."""
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="Simulation engine not running")

    await engine.inject_event(body.event_type, body.target_id)

    return {
        "status": "injected",
        "event_type": body.event_type,
        "target_id": body.target_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Event '{body.event_type}' injected successfully. Visual updates will propagate within 1–2 ticks.",
    }


@router.put("/time-acceleration")
async def set_time_acceleration(body: TimeAccelerationRequest, request: Request) -> dict:
    """Set simulation time acceleration factor (1x, 5x, 10x)."""
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        raise HTTPException(status_code=503, detail="Simulation engine not running")

    engine.set_time_acceleration(body.factor)

    return {
        "status": "updated",
        "time_acceleration": body.factor,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "message": f"Simulation speed set to {body.factor}x. Tick interval adjusted to {2.0 / body.factor:.2f}s.",
    }


@router.get("/status", response_model=SimulationStatusResponse)
async def get_simulation_status(request: Request) -> SimulationStatusResponse:
    """Return current simulation engine status."""
    engine = getattr(request.app.state, "engine", None)

    if engine is None:
        return SimulationStatusResponse(
            is_running=False,
            tick_count=0,
            time_acceleration=1,
            active_batches=0,
            critical_tanks=0,
            failed_equipment=0,
            timestamp=datetime.now(timezone.utc).isoformat(),
        )

    active_batches = sum(
        1 for b in engine._batches
        if b.get("stage") in ("mixing", "sampling", "lab")
    )
    critical_tanks = sum(
        1 for t in engine._tanks
        if t.get("status") in ("critical", "low")
    )
    failed_equipment = sum(
        1 for e in engine._equipment
        if e.get("status") in ("failed", "warning")
    )

    return SimulationStatusResponse(
        is_running=engine.is_running,
        tick_count=engine.tick_count,
        time_acceleration=engine.time_acceleration,
        active_batches=active_batches,
        critical_tanks=critical_tanks,
        failed_equipment=failed_equipment,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
