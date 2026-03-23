from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.supplier import Supplier
from app.ml.supply_optimizer import SupplyOptimizer

router = APIRouter(prefix="/supply", tags=["supply"])

_optimizer = SupplyOptimizer()


class SupplierResponse(BaseModel):
    id: int
    name: str
    material: str
    price_per_liter: float
    lead_time_days: int
    quality_grade: str
    reliability_score: float
    is_preferred: bool


class UpdateSupplierRequest(BaseModel):
    price_per_liter: Optional[float] = Field(None, gt=0)
    lead_time_days: Optional[int] = Field(None, ge=1, le=90)
    quality_grade: Optional[str] = Field(None, pattern="^[ABC]$")
    reliability_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    is_preferred: Optional[bool] = None


class OptimizeRequest(BaseModel):
    material: str
    volume_liters: float = Field(default=10000.0, ge=100.0)
    priority: str = Field(default="balanced", pattern="^(cost|quality|speed|balanced)$")


class CostBreakdownItem(BaseModel):
    material: str
    supplier_name: str
    volume_liters: float
    price_per_liter: float
    total_cost: float
    percentage_of_total: float


def _supplier_to_response(s: Supplier) -> SupplierResponse:
    return SupplierResponse(
        id=s.id,
        name=s.name,
        material=s.material,
        price_per_liter=s.price_per_liter,
        lead_time_days=s.lead_time_days,
        quality_grade=s.quality_grade,
        reliability_score=s.reliability_score,
        is_preferred=s.is_preferred,
    )


@router.get("/suppliers", response_model=list[SupplierResponse])
async def list_suppliers(db: AsyncSession = Depends(get_db)) -> list[SupplierResponse]:
    """Return all suppliers."""
    suppliers = (await db.execute(select(Supplier).order_by(Supplier.name))).scalars().all()
    return [_supplier_to_response(s) for s in suppliers]


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: int,
    body: UpdateSupplierRequest,
    db: AsyncSession = Depends(get_db),
) -> SupplierResponse:
    """Update supplier details."""
    result = await db.execute(select(Supplier).where(Supplier.id == supplier_id))
    supplier = result.scalar_one_or_none()
    if not supplier:
        raise HTTPException(status_code=404, detail=f"Supplier {supplier_id} not found")

    if body.price_per_liter is not None:
        supplier.price_per_liter = body.price_per_liter
    if body.lead_time_days is not None:
        supplier.lead_time_days = body.lead_time_days
    if body.quality_grade is not None:
        supplier.quality_grade = body.quality_grade
    if body.reliability_score is not None:
        supplier.reliability_score = body.reliability_score
    if body.is_preferred is not None:
        supplier.is_preferred = body.is_preferred

    await db.flush()
    await db.refresh(supplier)
    return _supplier_to_response(supplier)


@router.post("/optimize")
async def optimize_supply(
    body: OptimizeRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    """Run supply optimization for a given material and volume."""
    # Find relevant suppliers
    stmt = select(Supplier).where(Supplier.material.ilike(f"%{body.material}%"))
    suppliers = (await db.execute(stmt)).scalars().all()

    if not suppliers:
        # Fall back to all suppliers if none match
        suppliers = (await db.execute(select(Supplier))).scalars().all()

    supplier_dicts = [
        {
            "id": s.id,
            "name": s.name,
            "material": s.material,
            "price_per_liter": s.price_per_liter,
            "lead_time_days": s.lead_time_days,
            "quality_grade": s.quality_grade,
            "reliability_score": s.reliability_score,
        }
        for s in suppliers
    ]

    requirements = {
        "material": body.material,
        "volume_liters": body.volume_liters,
        "priority": body.priority,
    }

    return _optimizer.optimize(requirements, supplier_dicts)


@router.get("/cost-breakdown", response_model=list[CostBreakdownItem])
async def get_cost_breakdown(db: AsyncSession = Depends(get_db)) -> list[CostBreakdownItem]:
    """Return a cost breakdown by material from preferred suppliers."""
    suppliers = (await db.execute(select(Supplier))).scalars().all()

    # Simulate typical batch composition volumes
    material_volumes = {
        "SN150 Base Oil": 7500.0,
        "SN500 Base Oil": 5000.0,
        "PAO 6": 2500.0,
        "Viscosity Modifier": 800.0,
        "Antioxidant Package": 350.0,
        "Detergent Additive": 500.0,
        "Pour Point Depressant": 200.0,
        "Hydraulic Base": 3000.0,
    }

    # Select the cheapest supplier per material
    material_to_supplier: dict[str, Supplier] = {}
    for s in suppliers:
        existing = material_to_supplier.get(s.material)
        if existing is None or s.price_per_liter < existing.price_per_liter:
            material_to_supplier[s.material] = s

    items = []
    total = 0.0
    for material, volume in material_volumes.items():
        supplier = material_to_supplier.get(material)
        if supplier:
            cost = round(supplier.price_per_liter * volume, 2)
            total += cost
            items.append(CostBreakdownItem(
                material=material,
                supplier_name=supplier.name,
                volume_liters=volume,
                price_per_liter=supplier.price_per_liter,
                total_cost=cost,
                percentage_of_total=0.0,  # fill after total is known
            ))

    for item in items:
        item.percentage_of_total = round(item.total_cost / max(total, 1) * 100.0, 1)

    return items
