import random
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.blend_batch import BlendBatch
from app.models.recipe import Recipe
from app.ml.quality_predictor import QualityPredictor
from app.simulation.data_generators import interpolate_time_series

router = APIRouter(prefix="/quality", tags=["quality"])

_predictor = QualityPredictor()


class PredictionPoint(BaseModel):
    timestamp: str
    value: float


class QualityPredictionsResponse(BaseModel):
    batch_id: str
    viscosity_series: list[PredictionPoint]
    flash_point_series: list[PredictionPoint]
    tbn_series: list[PredictionPoint]
    current_viscosity: float
    current_flash_point: float
    current_tbn: float


class RiskMeterResponse(BaseModel):
    off_spec_risk: float
    risk_level: str
    contributing_factors: list[str]
    batch_id: str | None


class RecommendationsResponse(BaseModel):
    recommendations: list[str]
    priority: str
    generated_at: str


class ComparisonEntry(BaseModel):
    batch_id: str
    predicted_viscosity: float
    actual_viscosity: float
    predicted_flash_point: float
    actual_flash_point: float
    predicted_tbn: float
    actual_tbn: float
    on_spec: bool


@router.get("/predictions", response_model=QualityPredictionsResponse)
async def get_quality_predictions(db: AsyncSession = Depends(get_db)) -> QualityPredictionsResponse:
    """Rolling quality predictions for the most active batch."""
    # Find most active batch
    stmt = select(BlendBatch).where(
        BlendBatch.stage.in_(["mixing", "sampling", "lab"])
    ).order_by(BlendBatch.progress_pct.desc()).limit(1)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()

    recipe = None
    if batch and batch.recipe_id:
        r = await db.execute(select(Recipe).where(Recipe.id == batch.recipe_id))
        recipe = r.scalar_one_or_none()

    base_visc = recipe.predicted_viscosity if recipe and recipe.predicted_viscosity else 96.5
    base_flash = recipe.predicted_flash_point if recipe and recipe.predicted_flash_point else 218.0
    base_tbn = recipe.predicted_tbn if recipe and recipe.predicted_tbn else 9.2
    batch_id = batch.batch_id if batch else "N/A"

    visc_series = interpolate_time_series(base_visc, noise_scale=base_visc * 0.02, points=60)
    flash_series = interpolate_time_series(base_flash, noise_scale=base_flash * 0.01, points=60)
    tbn_series = interpolate_time_series(base_tbn, noise_scale=base_tbn * 0.03, points=60)

    return QualityPredictionsResponse(
        batch_id=batch_id,
        viscosity_series=[PredictionPoint(**p) for p in visc_series],
        flash_point_series=[PredictionPoint(**p) for p in flash_series],
        tbn_series=[PredictionPoint(**p) for p in tbn_series],
        current_viscosity=round(visc_series[-1]["value"], 2),
        current_flash_point=round(flash_series[-1]["value"], 2),
        current_tbn=round(tbn_series[-1]["value"], 2),
    )


@router.get("/risk-meter", response_model=RiskMeterResponse)
async def get_risk_meter(db: AsyncSession = Depends(get_db)) -> RiskMeterResponse:
    """Return current off-spec risk for active batch."""
    stmt = select(BlendBatch).where(
        BlendBatch.stage.in_(["mixing", "sampling"])
    ).order_by(BlendBatch.progress_pct.desc()).limit(1)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()

    recipe = None
    if batch and batch.recipe_id:
        r = await db.execute(select(Recipe).where(Recipe.id == batch.recipe_id))
        recipe = r.scalar_one_or_none()

    if recipe:
        risk = _predictor.off_spec_risk({
            "base_oil_pct": recipe.base_oil_pct,
            "viscosity_modifier_pct": recipe.viscosity_modifier_pct,
            "antioxidant_pct": recipe.antioxidant_pct,
            "detergent_pct": recipe.detergent_pct,
            "pour_point_depressant_pct": recipe.pour_point_depressant_pct,
        })
        # Add some runtime noise
        risk = max(0.0, min(100.0, risk + random.gauss(0, 3)))
    else:
        risk = round(random.uniform(5.0, 25.0), 1)

    risk_level = "critical" if risk > 50 else "warning" if risk > 25 else "normal"

    factors = []
    if risk > 50:
        factors.append("Viscosity deviation outside specification bounds")
        factors.append("Flash point approaching lower limit")
    elif risk > 25:
        factors.append("Viscosity trending toward upper bound")
        factors.append("Monitor TBN — currently near minimum threshold")
    else:
        factors.append("All quality parameters within normal range")

    return RiskMeterResponse(
        off_spec_risk=round(risk, 1),
        risk_level=risk_level,
        contributing_factors=factors,
        batch_id=batch.batch_id if batch else None,
    )


@router.get("/recommendations", response_model=RecommendationsResponse)
async def get_recommendations(db: AsyncSession = Depends(get_db)) -> RecommendationsResponse:
    """Return AI quality recommendations for current operation."""
    stmt = select(BlendBatch).where(
        BlendBatch.stage.in_(["mixing", "sampling", "lab"])
    ).order_by(BlendBatch.progress_pct.desc()).limit(1)
    result = await db.execute(stmt)
    batch = result.scalar_one_or_none()

    recipe = None
    if batch and batch.recipe_id:
        r = await db.execute(select(Recipe).where(Recipe.id == batch.recipe_id))
        recipe = r.scalar_one_or_none()

    recs = []
    priority = "low"

    if recipe:
        pred = _predictor.predict(
            recipe.base_oil_pct, recipe.viscosity_modifier_pct, recipe.antioxidant_pct,
            recipe.detergent_pct, recipe.pour_point_depressant_pct
        )

        if pred["off_spec_risk"] > 40:
            recs.append(f"URGENT: Off-spec risk at {pred['off_spec_risk']:.0f}%. Consider increasing antioxidant by 0.5% and reducing mixing temperature by 5°C.")
            priority = "high"
        elif pred["off_spec_risk"] > 20:
            recs.append(f"Moderate risk ({pred['off_spec_risk']:.0f}%). Monitor viscosity trend closely — currently at {pred['viscosity']:.1f} cSt.")
            priority = "medium"

        if pred["viscosity"] > 115:
            recs.append(f"Viscosity ({pred['viscosity']:.1f} cSt) trending high. Reduce viscosity modifier by 0.5–1.0% to bring within spec.")
        elif pred["viscosity"] < 88:
            recs.append(f"Viscosity ({pred['viscosity']:.1f} cSt) trending low. Increase viscosity modifier by 0.5–1.0% or lower base oil ratio.")

        if pred["flash_point"] < 208:
            recs.append(f"Flash point ({pred['flash_point']:.1f}°C) near lower limit. Increase base oil percentage or reduce volatile additives.")
            priority = "high"

        if pred["tbn"] < 7.0:
            recs.append(f"TBN ({pred['tbn']:.1f}) below recommended minimum. Increase detergent content by 0.5%.")

    if not recs:
        recs = [
            "All quality parameters are within specification. Continue standard monitoring protocol.",
            "Recommend scheduling lab sample analysis at 85% batch completion for final quality sign-off.",
            "Consider running Recipe Optimizer for the next batch to improve quality score by 2–3 points.",
        ]
        priority = "low"

    return RecommendationsResponse(
        recommendations=recs,
        priority=priority,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


@router.get("/comparison", response_model=list[ComparisonEntry])
async def get_quality_comparison(db: AsyncSession = Depends(get_db)) -> list[ComparisonEntry]:
    """Predicted vs simulated actual quality for last 10 completed batches."""
    stmt = (
        select(BlendBatch)
        .where(BlendBatch.stage == "completed")
        .order_by(BlendBatch.completed_at.desc())
        .limit(10)
    )
    batches = (await db.execute(stmt)).scalars().all()

    rng = random.Random(99)
    results = []

    for batch in batches:
        recipe = None
        if batch.recipe_id:
            r = await db.execute(select(Recipe).where(Recipe.id == batch.recipe_id))
            recipe = r.scalar_one_or_none()

        if recipe:
            pred = _predictor.predict(
                recipe.base_oil_pct, recipe.viscosity_modifier_pct, recipe.antioxidant_pct,
                recipe.detergent_pct, recipe.pour_point_depressant_pct
            )
            p_visc = pred["viscosity"]
            p_flash = pred["flash_point"]
            p_tbn = pred["tbn"]
        else:
            p_visc = rng.uniform(88.0, 112.0)
            p_flash = rng.uniform(210.0, 230.0)
            p_tbn = rng.uniform(7.0, 11.0)

        # Simulated actuals with small lab measurement noise
        a_visc = round(p_visc + rng.gauss(0, 1.8), 2)
        a_flash = round(p_flash + rng.gauss(0, 2.5), 2)
        a_tbn = round(p_tbn + rng.gauss(0, 0.4), 2)

        on_spec = (
            87.0 <= a_visc <= 118.0
            and a_flash >= 205.0
            and a_tbn >= 6.5
        )

        results.append(ComparisonEntry(
            batch_id=batch.batch_id,
            predicted_viscosity=round(p_visc, 2),
            actual_viscosity=a_visc,
            predicted_flash_point=round(p_flash, 2),
            actual_flash_point=a_flash,
            predicted_tbn=round(p_tbn, 2),
            actual_tbn=a_tbn,
            on_spec=on_spec,
        ))

    return results
