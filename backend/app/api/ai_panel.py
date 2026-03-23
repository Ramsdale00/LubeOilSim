import random
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.recipe import Recipe
from app.simulation.data_generators import generate_nlp_response
from app.ml.quality_predictor import QualityPredictor

router = APIRouter(prefix="/ai", tags=["ai"])

_predictor = QualityPredictor()


class AICommandRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)


class AICommandResponse(BaseModel):
    action: str
    message: str
    data: dict
    confidence: float
    processing_time_ms: float
    timestamp: str


class WhatIfScenarioRequest(BaseModel):
    scenario_a: dict = Field(..., description="Scenario A parameters")
    scenario_b: dict = Field(..., description="Scenario B parameters")
    label_a: str = Field(default="Scenario A")
    label_b: str = Field(default="Scenario B")


class WhatIfResponse(BaseModel):
    label_a: str
    label_b: str
    scenario_a_result: dict
    scenario_b_result: dict
    comparison_summary: str
    recommendation: str


class SavedScenario(BaseModel):
    id: str
    name: str
    description: str
    scenario_type: str
    parameters: dict
    created_at: str


@router.post("/command", response_model=AICommandResponse)
async def ai_command(body: AICommandRequest) -> AICommandResponse:
    """
    Process a natural language command and return an AI response.
    Supports: start/stop blends, optimize recipes, status queries, cost analysis.
    """
    import time
    start = time.perf_counter()

    response = generate_nlp_response(body.query)

    elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
    confidence = round(random.uniform(0.82, 0.97), 2)

    return AICommandResponse(
        action=response["action"],
        message=response["message"],
        data=response["data"],
        confidence=confidence,
        processing_time_ms=elapsed_ms,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/whatif", response_model=WhatIfResponse)
async def what_if_comparison(
    body: WhatIfScenarioRequest, db: AsyncSession = Depends(get_db)
) -> WhatIfResponse:
    """
    Run a what-if comparison between two recipe scenarios.
    Each scenario should include recipe ingredient percentages.
    """
    def evaluate_scenario(params: dict) -> dict:
        base_oil = params.get("base_oil_pct", 75.0)
        visc_mod = params.get("viscosity_modifier_pct", 8.0)
        antioxidant = params.get("antioxidant_pct", 3.5)
        detergent = params.get("detergent_pct", 5.0)
        ppdep = params.get("pour_point_depressant_pct", 2.0)
        temp = params.get("temperature_c", 80.0)

        pred = _predictor.predict(base_oil, visc_mod, antioxidant, detergent, ppdep, temp)

        # Estimate cost
        cost = (
            base_oil / 100 * 0.87
            + visc_mod / 100 * 1.65
            + antioxidant / 100 * 3.20
            + detergent / 100 * 2.80
            + ppdep / 100 * 2.10
        )

        return {
            "viscosity": pred["viscosity"],
            "flash_point": pred["flash_point"],
            "tbn": pred["tbn"],
            "off_spec_risk": pred["off_spec_risk"],
            "cost_per_liter": round(cost, 3),
            "quality_score": round(100.0 - pred["off_spec_risk"], 1),
            "parameters": params,
        }

    result_a = evaluate_scenario(body.scenario_a)
    result_b = evaluate_scenario(body.scenario_b)

    # Generate comparison summary
    cost_diff = result_b["cost_per_liter"] - result_a["cost_per_liter"]
    quality_diff = result_b["quality_score"] - result_a["quality_score"]
    risk_diff = result_b["off_spec_risk"] - result_a["off_spec_risk"]

    summary_parts = []
    if cost_diff < 0:
        summary_parts.append(f"{body.label_b} costs ${abs(cost_diff):.3f}/L less")
    elif cost_diff > 0:
        summary_parts.append(f"{body.label_a} costs ${abs(cost_diff):.3f}/L less")
    else:
        summary_parts.append("Both scenarios have similar costs")

    if quality_diff > 2:
        summary_parts.append(f"{body.label_b} has {quality_diff:.1f} points higher quality")
    elif quality_diff < -2:
        summary_parts.append(f"{body.label_a} has {abs(quality_diff):.1f} points higher quality")
    else:
        summary_parts.append("Quality scores are comparable")

    summary = ". ".join(summary_parts) + "."

    # Recommendation
    if result_a["off_spec_risk"] < result_b["off_spec_risk"] and result_a["cost_per_liter"] <= result_b["cost_per_liter"]:
        recommendation = f"Recommend {body.label_a}: lower off-spec risk ({result_a['off_spec_risk']:.0f}%) with competitive cost."
    elif result_b["off_spec_risk"] < result_a["off_spec_risk"] and result_b["cost_per_liter"] <= result_a["cost_per_liter"]:
        recommendation = f"Recommend {body.label_b}: lower off-spec risk ({result_b['off_spec_risk']:.0f}%) with competitive cost."
    elif result_a["quality_score"] > result_b["quality_score"]:
        recommendation = f"Recommend {body.label_a} for quality-focused production (score: {result_a['quality_score']:.0f}/100)."
    else:
        recommendation = f"Recommend {body.label_b} for balanced cost-quality trade-off (score: {result_b['quality_score']:.0f}/100)."

    return WhatIfResponse(
        label_a=body.label_a,
        label_b=body.label_b,
        scenario_a_result=result_a,
        scenario_b_result=result_b,
        comparison_summary=summary,
        recommendation=recommendation,
    )


@router.get("/scenarios", response_model=list[SavedScenario])
async def list_scenarios(db: AsyncSession = Depends(get_db)) -> list[SavedScenario]:
    """Return pre-defined what-if scenarios for demonstration."""
    now = datetime.now(timezone.utc)
    return [
        SavedScenario(
            id="sc-001",
            name="Cost Optimized vs. Current",
            description="Compare current SAE 10W-40 recipe against cost-optimized variant",
            scenario_type="recipe_comparison",
            parameters={
                "scenario_a": {"base_oil_pct": 74.0, "viscosity_modifier_pct": 9.5, "antioxidant_pct": 3.5, "detergent_pct": 5.0, "pour_point_depressant_pct": 2.0},
                "scenario_b": {"base_oil_pct": 77.0, "viscosity_modifier_pct": 8.0, "antioxidant_pct": 3.0, "detergent_pct": 4.5, "pour_point_depressant_pct": 1.8},
            },
            created_at=(now).isoformat(),
        ),
        SavedScenario(
            id="sc-002",
            name="High Quality Turbine Oil Variant",
            description="Explore premium antioxidant blend for turbine application",
            scenario_type="recipe_comparison",
            parameters={
                "scenario_a": {"base_oil_pct": 82.0, "viscosity_modifier_pct": 4.0, "antioxidant_pct": 6.0, "detergent_pct": 2.0, "pour_point_depressant_pct": 0.5},
                "scenario_b": {"base_oil_pct": 80.0, "viscosity_modifier_pct": 4.5, "antioxidant_pct": 7.5, "detergent_pct": 2.5, "pour_point_depressant_pct": 0.5},
            },
            created_at=(now).isoformat(),
        ),
        SavedScenario(
            id="sc-003",
            name="Temperature Effect on SAE 5W-30",
            description="Compare mixing outcomes at 75°C vs 85°C processing temperature",
            scenario_type="process_comparison",
            parameters={
                "scenario_a": {"base_oil_pct": 76.0, "viscosity_modifier_pct": 8.0, "antioxidant_pct": 4.0, "detergent_pct": 4.5, "pour_point_depressant_pct": 1.5, "temperature_c": 75.0},
                "scenario_b": {"base_oil_pct": 76.0, "viscosity_modifier_pct": 8.0, "antioxidant_pct": 4.0, "detergent_pct": 4.5, "pour_point_depressant_pct": 1.5, "temperature_c": 85.0},
            },
            created_at=(now).isoformat(),
        ),
    ]
