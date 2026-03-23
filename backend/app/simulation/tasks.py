import time
import random
from app.celery_app import celery_app
from app.simulation.data_generators import generate_quality_prediction


@celery_app.task(name="app.simulation.tasks.run_blend_batch_stage", bind=True, max_retries=3)
def run_blend_batch_stage(self, batch_id: str) -> dict:
    """Simulate processing a blend batch stage transition."""
    # Simulate async work
    time.sleep(random.uniform(1.0, 2.5))

    stages = ["queued", "mixing", "sampling", "lab", "completed"]
    return {
        "batch_id": batch_id,
        "status": "stage_advanced",
        "message": f"Batch {batch_id} stage processing completed",
        "timestamp": time.time(),
    }


@celery_app.task(name="app.simulation.tasks.run_recipe_optimization", bind=True)
def run_recipe_optimization(recipe_params: dict) -> dict:
    """Simulate recipe optimization — returns optimized recipe."""
    time.sleep(1.5)

    base_oil = recipe_params.get("base_oil_pct", 75.0)
    viscosity_modifier = recipe_params.get("viscosity_modifier_pct", 8.0)
    antioxidant = recipe_params.get("antioxidant_pct", 3.5)
    detergent = recipe_params.get("detergent_pct", 5.0)
    ppdep = recipe_params.get("pour_point_depressant_pct", 2.0)
    mode = recipe_params.get("mode", "balanced")

    # Apply optimization adjustments based on mode
    if mode == "cost":
        # Reduce expensive components
        optimized_base_oil = base_oil + random.uniform(1.0, 3.0)
        optimized_viscosity = viscosity_modifier - random.uniform(0.5, 1.5)
        optimized_antioxidant = antioxidant - random.uniform(0.2, 0.5)
        optimized_detergent = detergent
        optimized_ppdep = ppdep - random.uniform(0.1, 0.3)
        cost_per_liter = round(1.65 + random.uniform(-0.05, 0.05), 2)
        quality_score = round(78.0 + random.uniform(-2, 2), 1)
    elif mode == "quality":
        # Increase premium components
        optimized_base_oil = base_oil - random.uniform(1.0, 2.0)
        optimized_viscosity = viscosity_modifier + random.uniform(0.3, 0.8)
        optimized_antioxidant = antioxidant + random.uniform(0.5, 1.2)
        optimized_detergent = detergent + random.uniform(0.3, 0.7)
        optimized_ppdep = ppdep + random.uniform(0.1, 0.3)
        cost_per_liter = round(2.15 + random.uniform(-0.05, 0.10), 2)
        quality_score = round(93.0 + random.uniform(-1, 2), 1)
    else:
        # Balanced
        optimized_base_oil = base_oil + random.uniform(-1.0, 1.0)
        optimized_viscosity = viscosity_modifier + random.uniform(-0.5, 0.5)
        optimized_antioxidant = antioxidant + random.uniform(-0.2, 0.3)
        optimized_detergent = detergent + random.uniform(-0.2, 0.2)
        optimized_ppdep = ppdep + random.uniform(-0.1, 0.1)
        cost_per_liter = round(1.87 + random.uniform(-0.05, 0.05), 2)
        quality_score = round(88.0 + random.uniform(-2, 3), 1)

    prediction = generate_quality_prediction(
        optimized_base_oil, optimized_viscosity, optimized_antioxidant,
        optimized_detergent, optimized_ppdep
    )

    return {
        "mode": mode,
        "original": recipe_params,
        "optimized": {
            "base_oil_pct": round(optimized_base_oil, 2),
            "viscosity_modifier_pct": round(optimized_viscosity, 2),
            "antioxidant_pct": round(optimized_antioxidant, 2),
            "detergent_pct": round(optimized_detergent, 2),
            "pour_point_depressant_pct": round(optimized_ppdep, 2),
            "cost_per_liter": cost_per_liter,
            "quality_score": quality_score,
        },
        "predicted_properties": prediction,
        "improvement": {
            "cost_change_pct": round((cost_per_liter - recipe_params.get("cost_per_liter", 1.85)) / 1.85 * 100, 1),
            "quality_change": round(quality_score - recipe_params.get("quality_score", 85.0), 1),
        },
    }


@celery_app.task(name="app.simulation.tasks.run_supplier_optimization", bind=True)
def run_supplier_optimization(self, requirements: dict) -> dict:
    """Simulate supplier optimization — returns ranked supplier recommendations."""
    time.sleep(0.8)

    material = requirements.get("material", "SN150 Base Oil")
    volume_liters = requirements.get("volume_liters", 10000)
    priority = requirements.get("priority", "balanced")  # cost/quality/speed

    # Simulated supplier candidates
    candidates = [
        {"name": "PetroSupply Co.", "material": material, "price_per_liter": 0.85, "lead_time_days": 5, "quality_grade": "A", "reliability_score": 0.96},
        {"name": "BaseChem Industries", "material": material, "price_per_liter": 0.92, "lead_time_days": 7, "quality_grade": "A", "reliability_score": 0.93},
        {"name": "LubriChem Direct", "material": material, "price_per_liter": 0.78, "lead_time_days": 14, "quality_grade": "B", "reliability_score": 0.82},
        {"name": "ChemTrade Global", "material": material, "price_per_liter": 0.98, "lead_time_days": 3, "quality_grade": "A", "reliability_score": 0.91},
        {"name": "RegionalOil Ltd.", "material": material, "price_per_liter": 0.81, "lead_time_days": 10, "quality_grade": "B", "reliability_score": 0.87},
    ]

    # Score each candidate
    grade_scores = {"A": 1.0, "B": 0.7, "C": 0.4}
    for c in candidates:
        price_score = 1.0 - (c["price_per_liter"] - 0.78) / 0.22
        lead_score = 1.0 - (c["lead_time_days"] - 3) / 11
        quality_score = grade_scores.get(c["quality_grade"], 0.5)
        reliability_score = c["reliability_score"]

        if priority == "cost":
            weights = [0.5, 0.15, 0.2, 0.15]
        elif priority == "quality":
            weights = [0.15, 0.15, 0.5, 0.2]
        elif priority == "speed":
            weights = [0.2, 0.5, 0.15, 0.15]
        else:
            weights = [0.3, 0.25, 0.25, 0.2]

        c["composite_score"] = round(
            price_score * weights[0]
            + lead_score * weights[1]
            + quality_score * weights[2]
            + reliability_score * weights[3],
            4,
        )
        c["total_cost"] = round(c["price_per_liter"] * volume_liters, 2)
        c["rank"] = 0

    ranked = sorted(candidates, key=lambda x: x["composite_score"], reverse=True)
    for i, c in enumerate(ranked):
        c["rank"] = i + 1

    # Split allocation: top 2 suppliers share order
    if len(ranked) >= 2:
        ranked[0]["allocation_pct"] = 70
        ranked[1]["allocation_pct"] = 30
        for c in ranked[2:]:
            c["allocation_pct"] = 0
    elif ranked:
        ranked[0]["allocation_pct"] = 100

    blended_cost = round(
        sum(c["price_per_liter"] * c.get("allocation_pct", 0) / 100 for c in ranked) * volume_liters, 2
    )

    return {
        "requirements": requirements,
        "ranked_suppliers": ranked,
        "recommended_allocation": {
            c["name"]: c.get("allocation_pct", 0) for c in ranked[:3]
        },
        "blended_total_cost": blended_cost,
        "savings_vs_worst": round((ranked[-1]["total_cost"] - blended_cost), 2) if ranked else 0,
    }
