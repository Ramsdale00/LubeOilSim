"""
Savings Impact API
Exposes OmniBlend Discover savings calculations as REST endpoints.
"""

from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.simulation.savings_calculator import (
    predict_blend_kv,
    solve_rebalance,
    calculate_batch_savings,
    compute_portfolio_scenarios,
)

router = APIRouter(tags=["savings"])

# ── Seed lube profiles (mirrors frontend SEED_LUBE_PROFILES) ─────────────────

LUBE_PROFILES: list[dict] = [
    {
        "lube_id": "lp1", "lube_name": "SAE 15W-40 HD", "grade_code": "15W-40",
        "target_kv": 14.5, "spec_window": 0.3, "batch_kl": 10, "density": 0.876,
        "batches_per_year": 48, "additive_cost_mt": 2500, "base_oil_cost_mt": 850,
        "topup_pct": 0.5, "current_rft_pct": 93.5, "hourly_capacity_cost": 28,
        "components": [
            {"name": "SN 150 Base Oil", "role": "swing_light", "mass_pct": 42, "std_kv": 4.5},
            {"name": "SN 500 Base Oil", "role": "swing_heavy", "mass_pct": 38, "std_kv": 12.0},
            {"name": "DI Package HD", "role": "additive", "mass_pct": 13, "std_kv": 155, "std_ca": 1.82, "std_zn": 0.95, "std_p": 0.087},
            {"name": "OCP Viscosity Mod", "role": "vm", "mass_pct": 5, "std_kv": 1200},
            {"name": "PPD-7", "role": "fixed", "mass_pct": 2, "std_kv": 180},
        ],
    },
    {
        "lube_id": "lp2", "lube_name": "SAE 20W-50", "grade_code": "20W-50",
        "target_kv": 18.5, "spec_window": 0.4, "batch_kl": 12, "density": 0.882,
        "batches_per_year": 36, "additive_cost_mt": 2500, "base_oil_cost_mt": 850,
        "topup_pct": 0.5, "current_rft_pct": 95.0, "hourly_capacity_cost": 26,
        "components": [
            {"name": "SN 150 Base Oil", "role": "swing_light", "mass_pct": 35, "std_kv": 4.5},
            {"name": "SN 600 Base Oil", "role": "swing_heavy", "mass_pct": 45, "std_kv": 16.0},
            {"name": "DI Package 20W50", "role": "additive", "mass_pct": 14, "std_kv": 160, "std_ca": 1.95, "std_zn": 1.02, "std_p": 0.091},
            {"name": "OCP Viscosity Mod", "role": "vm", "mass_pct": 4, "std_kv": 1200},
            {"name": "PPD-7", "role": "fixed", "mass_pct": 2, "std_kv": 180},
        ],
    },
    {
        "lube_id": "lp3", "lube_name": "SAE 5W-30 FS", "grade_code": "5W-30",
        "target_kv": 10.5, "spec_window": 0.3, "batch_kl": 8, "density": 0.858,
        "batches_per_year": 60, "additive_cost_mt": 3200, "base_oil_cost_mt": 1100,
        "topup_pct": 0.4, "current_rft_pct": 96.5, "hourly_capacity_cost": 32,
        "components": [
            {"name": "Group III 4cSt", "role": "swing_light", "mass_pct": 48, "std_kv": 4.1},
            {"name": "Group III 6cSt", "role": "swing_heavy", "mass_pct": 30, "std_kv": 6.1},
            {"name": "GF-6 DI Package", "role": "additive", "mass_pct": 12, "std_kv": 130, "std_ca": 1.22, "std_zn": 0.72, "std_p": 0.072},
            {"name": "HSD Viscosity Mod", "role": "vm", "mass_pct": 8, "std_kv": 2500},
            {"name": "PPD-4", "role": "fixed", "mass_pct": 2, "std_kv": 160},
        ],
    },
    {
        "lube_id": "lp4", "lube_name": "Hydraulic ISO 46", "grade_code": "ISO 46",
        "target_kv": 8.5, "spec_window": 0.25, "batch_kl": 15, "density": 0.869,
        "batches_per_year": 52, "additive_cost_mt": 1800, "base_oil_cost_mt": 820,
        "topup_pct": 0.3, "current_rft_pct": 97.0, "hourly_capacity_cost": 22,
        "components": [
            {"name": "SN 100 Base Oil", "role": "swing_light", "mass_pct": 50, "std_kv": 3.8},
            {"name": "SN 300 Base Oil", "role": "swing_heavy", "mass_pct": 38, "std_kv": 8.5},
            {"name": "AW Additive Pkg", "role": "additive", "mass_pct": 9, "std_kv": 95, "std_zn": 0.055, "std_p": 0.050},
            {"name": "PPD-6", "role": "fixed", "mass_pct": 3, "std_kv": 150},
        ],
    },
    {
        "lube_id": "lp5", "lube_name": "Gear Oil EP 90", "grade_code": "80W-90",
        "target_kv": 14.0, "spec_window": 0.5, "batch_kl": 8, "density": 0.895,
        "batches_per_year": 30, "additive_cost_mt": 2200, "base_oil_cost_mt": 870,
        "topup_pct": 0.5, "current_rft_pct": 91.0, "hourly_capacity_cost": 24,
        "components": [
            {"name": "SN 150 Base Oil", "role": "swing_light", "mass_pct": 40, "std_kv": 4.5},
            {"name": "SN 500 Base Oil", "role": "swing_heavy", "mass_pct": 41, "std_kv": 12.0},
            {"name": "GL-5 EP Package", "role": "additive", "mass_pct": 16, "std_kv": 200, "std_p": 0.12},
            {"name": "PPD-7", "role": "fixed", "mass_pct": 3, "std_kv": 180},
        ],
    },
    {
        "lube_id": "lp6", "lube_name": "Turbine Oil 32", "grade_code": "Turbine 32",
        "target_kv": 5.5, "spec_window": 0.2, "batch_kl": 10, "density": 0.855,
        "batches_per_year": 24, "additive_cost_mt": 1600, "base_oil_cost_mt": 900,
        "topup_pct": 0.3, "current_rft_pct": 97.5, "hourly_capacity_cost": 20,
        "components": [
            {"name": "Group II 3.5cSt", "role": "swing_light", "mass_pct": 55, "std_kv": 3.5},
            {"name": "Group II 6cSt", "role": "swing_heavy", "mass_pct": 36, "std_kv": 6.0},
            {"name": "Turbine Additive", "role": "additive", "mass_pct": 7, "std_kv": 80},
            {"name": "Antioxidant AO-5", "role": "fixed", "mass_pct": 2, "std_kv": 60},
        ],
    },
]

# In-memory ledger (simulated persistence)
_BATCH_LEDGER: list[dict] = []


# ── Pydantic models ───────────────────────────────────────────────────────────

class COAInputsModel(BaseModel):
    swing_heavy_actual_kv: float | None = None
    swing_light_actual_kv: float | None = None
    additive_actual_kv:    float | None = None
    additive_actual_ca:    float | None = None
    additive_actual_zn:    float | None = None
    additive_actual_p:     float | None = None

class BatchCalculateRequest(BaseModel):
    lube_id: str
    batch_mt: float
    batch_date: str
    coa: COAInputsModel

class BatchCommitRequest(BaseModel):
    lube_id: str
    batch_mt: float
    batch_date: str
    coa: COAInputsModel
    batch_id: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_profile(lube_id: str) -> dict | None:
    return next((p for p in LUBE_PROFILES if p["lube_id"] == lube_id), None)

def _coa_dict(coa: COAInputsModel) -> dict:
    return {
        "swing_heavy_actual_kv": coa.swing_heavy_actual_kv,
        "swing_light_actual_kv": coa.swing_light_actual_kv,
        "additive_actual_kv":    coa.additive_actual_kv,
        "additive_actual_ca":    coa.additive_actual_ca,
        "additive_actual_zn":    coa.additive_actual_zn,
        "additive_actual_p":     coa.additive_actual_p,
    }


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/lube-profiles")
def get_lube_profiles() -> list[dict]:
    """Return all configured lube profiles."""
    return LUBE_PROFILES


@router.post("/calculate")
def calculate_savings(req: BatchCalculateRequest) -> dict[str, Any]:
    """Calculate savings for a batch (preview, not persisted)."""
    profile = _get_profile(req.lube_id)
    if not profile:
        return {"error": f"Lube profile '{req.lube_id}' not found"}

    coa = _coa_dict(req.coa)
    rebalance = solve_rebalance(profile, coa)
    savings = calculate_batch_savings(profile, coa, req.batch_mt, rebalance)
    predicted_kv = predict_blend_kv(profile, coa)

    return {
        "lube_id": req.lube_id,
        "lube_name": profile["lube_name"],
        "batch_mt": req.batch_mt,
        "batch_date": req.batch_date,
        "coa": coa,
        "predicted_kv": round(predicted_kv, 3),
        "target_kv": profile["target_kv"],
        "spec_window": profile["spec_window"],
        "rebalance": rebalance,
        "savings": savings,
    }


@router.post("/commit")
def commit_batch(req: BatchCommitRequest) -> dict[str, Any]:
    """Calculate and persist batch savings to in-memory ledger."""
    profile = _get_profile(req.lube_id)
    if not profile:
        return {"error": f"Lube profile '{req.lube_id}' not found"}

    coa = _coa_dict(req.coa)
    rebalance = solve_rebalance(profile, coa)
    savings = calculate_batch_savings(profile, coa, req.batch_mt, rebalance)

    record: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "batch_id": req.batch_id or f"B-{datetime.utcnow().strftime('%Y-%m-%d-%H%M')}",
        "lube_id": req.lube_id,
        "lube_name": profile["lube_name"],
        "batch_mt": req.batch_mt,
        "batch_date": req.batch_date,
        "coa": coa,
        "rebalance": rebalance,
        "savings": savings,
        "in_spec": rebalance.get("in_spec", False),
        "committed_at": datetime.utcnow().isoformat(),
    }
    _BATCH_LEDGER.insert(0, record)
    return record


@router.get("/ledger")
def get_ledger(limit: int = 50) -> list[dict]:
    """Return recent batch savings records."""
    return _BATCH_LEDGER[:limit]


@router.get("/portfolio")
def get_portfolio() -> dict[str, Any]:
    """Return portfolio-level scenario projections."""
    return compute_portfolio_scenarios(_BATCH_LEDGER, LUBE_PROFILES)


@router.get("/scenarios")
def get_scenarios() -> dict[str, Any]:
    """Return conservative / expected / optimistic scenario breakdown."""
    scenarios = compute_portfolio_scenarios(_BATCH_LEDGER, LUBE_PROFILES)
    return {
        "conservative": scenarios["conservative"],
        "expected":     scenarios["expected"],
        "optimistic":   scenarios["optimistic"],
        "captured_last_30d": scenarios["captured_last_30d"],
        "metadata": {
            "annual_mt": scenarios["annual_mt"],
            "lube_count": scenarios["lube_count"],
            "batch_count": scenarios["batch_count"],
        },
    }
