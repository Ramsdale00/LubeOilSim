import math
import random
from typing import Any


def generate_quality_prediction(
    base_oil: float,
    viscosity_modifier: float,
    antioxidant: float,
    detergent: float,
    ppdep: float,
    temp: float = 80.0,
) -> dict[str, Any]:
    """
    Simulate quality prediction for a lubricant recipe.
    Returns viscosity, flash_point, tbn, confidence intervals, and off_spec_risk.
    """
    # Viscosity: higher viscosity modifier = higher viscosity; base oil dilutes
    viscosity = (
        85.0
        + viscosity_modifier * 2.2
        - (100 - base_oil) * 0.3
        + antioxidant * 0.5
        + (temp - 80.0) * (-0.1)
        + random.gauss(0, 1.5)
    )
    viscosity = max(82.0, min(125.0, viscosity))

    # Flash point: higher base oil = higher flash point; temp affects slightly
    flash_point = (
        200.0
        + base_oil * 0.4
        - viscosity_modifier * 0.3
        + antioxidant * 0.8
        + detergent * 0.2
        + (temp - 80.0) * 0.05
        + random.gauss(0, 2.0)
    )
    flash_point = max(198.0, min(242.0, flash_point))

    # TBN: detergent raises TBN; antioxidant adds marginally
    tbn = (
        5.5
        + detergent * 0.6
        + antioxidant * 0.35
        + viscosity_modifier * 0.05
        + random.gauss(0, 0.3)
    )
    tbn = max(5.0, min(13.0, tbn))

    # Confidence intervals ± 5%
    confidence_low_viscosity = round(viscosity * 0.95, 2)
    confidence_high_viscosity = round(viscosity * 1.05, 2)
    confidence_low_flash = round(flash_point * 0.975, 2)
    confidence_high_flash = round(flash_point * 1.025, 2)
    confidence_low_tbn = round(tbn * 0.92, 2)
    confidence_high_tbn = round(tbn * 1.08, 2)

    # Off-spec risk: penalise extreme values
    risk = 0.0
    if viscosity < 87 or viscosity > 118:
        risk += 30.0
    if flash_point < 205:
        risk += 25.0
    if tbn < 6.5:
        risk += 20.0
    if base_oil < 65 or base_oil > 88:
        risk += 15.0
    risk = min(100.0, risk + random.gauss(5, 3))
    risk = max(0.0, risk)

    return {
        "viscosity": round(viscosity, 2),
        "flash_point": round(flash_point, 2),
        "tbn": round(tbn, 2),
        "confidence_low_viscosity": confidence_low_viscosity,
        "confidence_high_viscosity": confidence_high_viscosity,
        "confidence_low_flash": confidence_low_flash,
        "confidence_high_flash": confidence_high_flash,
        "confidence_low_tbn": confidence_low_tbn,
        "confidence_high_tbn": confidence_high_tbn,
        "off_spec_risk": round(risk, 1),
    }


def generate_kpi_snapshot(
    batches: list[dict],
    tanks: list[dict],
    equipment: list[dict],
) -> dict[str, Any]:
    """Generate a KPI snapshot from current simulation state."""
    completed = [b for b in batches if b.get("stage") == "completed"]
    mixing = [b for b in batches if b.get("stage") == "mixing"]
    active = mixing + [b for b in batches if b.get("stage") in ("sampling", "lab")]

    production_volume = sum(b.get("volume_liters", 0) for b in completed)
    production_volume += sum(
        b.get("volume_liters", 0) * b.get("progress_pct", 0) / 100.0 for b in active
    )

    if completed:
        cost_per_batch = sum(
            b.get("volume_liters", 0) * random.uniform(1.75, 2.20)
            for b in completed
        ) / len(completed)
    else:
        cost_per_batch = 18500.0

    # Energy: mixing batches consume ~45 kWh each
    energy_kwh = len(mixing) * 45.0 + len(active) * 12.0 + random.uniform(20, 40)

    running_equip = [e for e in equipment if e.get("status") == "running"]
    utilization_pct = (len(running_equip) / max(len(equipment), 1)) * 100.0

    total_capacity = sum(t.get("capacity_liters", 50000) for t in tanks)
    total_current = sum(
        t.get("capacity_liters", 50000) * t.get("current_level", 0.7) for t in tanks
    )
    tank_fill_pct = (total_current / max(total_capacity, 1)) * 100.0

    on_spec = sum(1 for b in completed if not b.get("alerts"))
    on_spec_rate = (on_spec / max(len(completed), 1)) * 100.0

    return {
        "production_volume_liters": round(production_volume, 0),
        "cost_per_batch": round(cost_per_batch, 2),
        "energy_kwh": round(energy_kwh, 1),
        "utilization_pct": round(utilization_pct, 1),
        "batches_today": len(batches),
        "batches_mixing": len(mixing),
        "on_spec_rate": round(on_spec_rate, 1),
        "tank_fill_pct": round(tank_fill_pct, 1),
        "active_alerts": sum(1 for b in batches if b.get("alerts")),
    }


def generate_energy_heatmap() -> list[list[float]]:
    """
    Generate a 24h x 8 equipment energy consumption matrix (kWh).
    Returns list of 24 rows (hours), each with 8 equipment values.
    """
    equipment_names = [
        "Blender B1", "Blender B2", "Blender B3",
        "Pump P-01", "Pump P-02",
        "Heat Exchanger HX-1", "Filtration Unit F-1", "Mixing Tank MT-1",
    ]

    rng = random.Random(42)
    # Base consumption per equipment type (kWh)
    base_consumption = [42, 38, 35, 8, 7, 22, 12, 18]

    result = []
    for hour in range(24):
        # Simulate shift patterns: heavy production 6-22h, maintenance 0-6h
        if 6 <= hour <= 22:
            shift_multiplier = 1.0 + 0.3 * math.sin((hour - 6) * math.pi / 16)
        else:
            shift_multiplier = 0.3

        row = []
        for j, base in enumerate(base_consumption):
            noise = rng.uniform(0.85, 1.15)
            val = round(base * shift_multiplier * noise, 1)
            row.append(val)
        result.append(row)

    return result


def generate_nlp_response(query: str) -> dict[str, Any]:
    """
    Pattern-match NLP queries and return simulated AI responses.
    """
    query_lower = query.lower()

    if any(word in query_lower for word in ["start", "begin", "launch", "run"]):
        if "blend" in query_lower or "batch" in query_lower:
            batch_id = f"B-2024-{random.randint(100, 999)}"
            return {
                "action": "start_blend",
                "message": f"Initiating blend batch {batch_id}. Loading recipe parameters and pre-heating to 75°C. Estimated completion: 4.5 hours.",
                "data": {"batch_id": batch_id, "estimated_hours": 4.5, "status": "queued"},
            }
        return {
            "action": "start_general",
            "message": "Please specify what you want to start — a blend batch, equipment, or pump.",
            "data": {},
        }

    if any(word in query_lower for word in ["stop", "halt", "pause", "abort"]):
        return {
            "action": "stop_operation",
            "message": "Stopping operation safely. Initiating controlled cooldown sequence. All active pumps will shut down within 30 seconds.",
            "data": {"cooldown_seconds": 30},
        }

    if any(word in query_lower for word in ["optimize", "optimise", "best", "cheapest", "efficient"]):
        if "cost" in query_lower or "cheap" in query_lower or "price" in query_lower:
            return {
                "action": "optimize_cost",
                "message": "Running cost optimization across 10 recipe candidates. Recommendation: Reduce PAO 6 by 3% and substitute with SN500 base oil. Estimated savings: $0.18/liter (-9.5%). Quality score impact: -2.1 points.",
                "data": {"savings_per_liter": 0.18, "quality_impact": -2.1, "mode": "cost"},
            }
        return {
            "action": "optimize_balanced",
            "message": "Running balanced optimization. Best candidate: SAE 10W-40 variant with adjusted antioxidant (+0.5%). Predicted viscosity: 97.2 cSt, flash point: 219°C, TBN: 9.4. Cost: $1.87/L.",
            "data": {"viscosity": 97.2, "flash_point": 219.0, "tbn": 9.4, "cost_per_liter": 1.87},
        }

    if "status" in query_lower:
        return {
            "action": "status_report",
            "message": "Current plant status: 2 batches mixing (B-2024-003 at 30%, B-2024-004 at 65%), 1 in sampling, 1 in lab. Tank T-112 critically low (12%). Equipment alert: Pump P-02 health at 41%.",
            "data": {
                "batches_active": 4,
                "tanks_critical": 1,
                "equipment_warnings": 2,
                "overall_status": "warning",
            },
        }

    if "tank" in query_lower:
        return {
            "action": "tank_info",
            "message": "Tank farm overview: 12 tanks active. T-112 (Viscosity Modifier) critically low at 12% — immediate reorder recommended. T-107 (Detergent Additive) at 40% — monitor closely. All other tanks nominal.",
            "data": {"critical_tanks": ["T-112"], "low_tanks": ["T-107"], "nominal_tanks": 10},
        }

    if "recipe" in query_lower or "formul" in query_lower:
        return {
            "action": "recipe_info",
            "message": "10 recipes loaded. Top performers: Transformer Oil (95/100 quality), SAE 5W-30 (91/100). Recommended for next batch: SAE 10W-40 based on current tank inventory. All base-oil tanks sufficiently filled.",
            "data": {"total_recipes": 10, "recommended": "SAE 10W-40"},
        }

    if "cost" in query_lower or "price" in query_lower or "budget" in query_lower:
        return {
            "action": "cost_analysis",
            "message": "Cost analysis: Average cost per batch today: $18,420. Best supplier for SN150: PetroSupply Co. at $0.85/L. Current spend rate: $2,340/hour. Projected daily cost: $56,160.",
            "data": {"avg_batch_cost": 18420, "daily_cost_projection": 56160, "cost_per_hour": 2340},
        }

    if "maintenance" in query_lower or "repair" in query_lower or "health" in query_lower:
        return {
            "action": "maintenance_info",
            "message": "Maintenance alerts: Pump P-02 at 41% health — service due in 5 days. Blender B3 at 62% health — service due in 10 days. Recommend scheduling P-02 maintenance this week to avoid unplanned downtime.",
            "data": {"critical": ["Pump P-02"], "warning": ["Blender B3"], "all_clear": ["Blender B1", "Blender B2", "Heat Exchanger HX-1"]},
        }

    # Default
    return {
        "action": "unknown",
        "message": f"Processing query: '{query}'. I can help with blend operations, tank management, recipe optimization, cost analysis, equipment status, and quality predictions. Try: 'Start blend B101', 'Optimize recipe for cost', or 'Show tank status'.",
        "data": {"suggestions": ["start blend", "optimize recipe", "tank status", "equipment health", "cost analysis"]},
    }


def interpolate_time_series(
    base: float,
    noise_scale: float = 1.0,
    points: int = 60,
) -> list[dict[str, Any]]:
    """Generate a smooth random-walk time series."""
    from datetime import datetime, timezone, timedelta

    now = datetime.now(timezone.utc)
    result = []
    current = base
    for i in range(points):
        ts = now - timedelta(seconds=(points - i) * 30)
        delta = random.gauss(0, noise_scale * 0.05)
        # Slight mean reversion
        current = current + delta - (current - base) * 0.02
        result.append({
            "timestamp": ts.isoformat(),
            "value": round(current, 3),
        })
    return result


def temp_to_color(temp_c: float) -> str:
    """Map temperature to hex color: blue (20°C) → amber (60°C) → red (100°C)."""
    # Normalise to 0-1 range
    t = max(0.0, min(1.0, (temp_c - 20.0) / 80.0))

    if t < 0.5:
        # Blue to amber (0.0 → 0.5)
        ratio = t * 2.0
        r = int(30 + ratio * (255 - 30))
        g = int(144 + ratio * (191 - 144))
        b = int(255 + ratio * (0 - 255))
    else:
        # Amber to red (0.5 → 1.0)
        ratio = (t - 0.5) * 2.0
        r = int(255)
        g = int(191 - ratio * 191)
        b = 0

    return f"#{r:02x}{g:02x}{b:02x}"


def generate_maintenance_prediction(equipment: dict[str, Any]) -> dict[str, Any]:
    """Predict days to failure and confidence for an equipment item."""
    health = equipment.get("health_pct", 80.0)

    # Linear degradation estimate
    degradation_rate = 0.005 * 60  # per hour at 1 tick/2s
    if health <= 10.0:
        days_to_failure = 0
        confidence = 0.98
    else:
        days_to_failure = round((health - 10.0) / (degradation_rate * 24), 1)
        # Confidence higher when health is low (more predictable)
        confidence = round(min(0.99, 0.6 + (100 - health) / 200), 2)

    risk_level = "critical" if days_to_failure < 5 else "warning" if days_to_failure < 15 else "normal"

    return {
        "equipment_id": equipment.get("id"),
        "equipment_name": equipment.get("name"),
        "days_to_failure": days_to_failure,
        "confidence": confidence,
        "risk_level": risk_level,
        "recommended_action": (
            "Immediate service required" if risk_level == "critical"
            else "Schedule maintenance soon" if risk_level == "warning"
            else "Continue monitoring"
        ),
    }
