"""
OmniBlend Discover — Savings Calculator
Ported from OmniBlend_Discover_Calculator_v15.html

Three independent savings streams:
  Stream 1 – Material Avoidance (rebalance-driven top-up avoidance)
  Stream 2 – Elemental Potency Saving (Ca/Zn/P over-potency capture)
  Stream 3 – RFT Lift (Right-First-Time quality improvement value)

Reference plant calibration: 25,000 MT/yr · $3.15/MT RFT rate
"""

from __future__ import annotations
from typing import Any

RFT_TARGET = 0.99
RFT_BASELINE = 0.90
RFT_RATE_PER_MT = 3.15        # $/MT — reference plant calibration
BATCH_DAYS_BACK = 30
SCENARIO_MULTIPLIERS = {"conservative": 0.67, "expected": 1.00, "optimistic": 1.33}


# ── Viscosity prediction ──────────────────────────────────────────────────────

def predict_blend_kv(profile: dict, coa: dict) -> float:
    """
    Proportional-perturbation viscosity model.
    predKV = targetKV × (1 + Σ(pctVariance_i × massFrac_i × sensitivity_i))

    Sensitivity: 1.0 for swing/base, 0.6 for additive, 1.5 for VM.
    """
    target_kv = profile["target_kv"]
    perturbation = 0.0
    for comp in profile.get("components", []):
        role = comp.get("role", "")
        std_kv = comp.get("std_kv")
        actual_kv: float | None = None
        if role == "swing_heavy":
            actual_kv = coa.get("swing_heavy_actual_kv")
        elif role == "swing_light":
            actual_kv = coa.get("swing_light_actual_kv")
        elif role == "additive":
            actual_kv = coa.get("additive_actual_kv")
        elif role == "vm":
            actual_kv = coa.get("vm_actual_kv")

        if actual_kv is not None and std_kv and std_kv > 0:
            pct_variance = (actual_kv - std_kv) / std_kv
            mass_frac = comp.get("mass_pct", 0) / 100.0
            sensitivity = 1.5 if role == "vm" else 0.6 if role == "additive" else 1.0
            perturbation += pct_variance * mass_frac * sensitivity

    return target_kv * (1 + perturbation)


# ── Rebalance solver ──────────────────────────────────────────────────────────

def solve_rebalance(profile: dict, coa: dict) -> dict[str, Any]:
    """
    Linear scan: shift = -5.0 pp to +5.0 pp in 0.05 pp steps.
    Moves swing-heavy/swing-light pair to correct viscosity deviation.
    Returns rebalance result dict.
    """
    heavy = next((c for c in profile.get("components", []) if c["role"] == "swing_heavy"), None)
    light = next((c for c in profile.get("components", []) if c["role"] == "swing_light"), None)
    target_kv = profile["target_kv"]
    spec_window = profile.get("spec_window", 0.3)

    pred_kv_before = predict_blend_kv(profile, coa)
    in_spec_before = abs(pred_kv_before - target_kv) <= spec_window

    if in_spec_before or not heavy or not light:
        msg = "✓ Standard recipe lands in spec" if in_spec_before else "⚠ No swing pair to rebalance"
        return {
            "applied": False,
            "shift_delta": 0.0,
            "predicted_kv_before": round(pred_kv_before, 3),
            "achieved_kv": round(pred_kv_before, 3),
            "in_spec": in_spec_before,
            "message": msg,
        }

    heavy_std = heavy.get("std_kv", 12.0)
    light_std = light.get("std_kv", 4.5)
    heavy_actual = coa.get("swing_heavy_actual_kv", heavy_std)
    light_actual = coa.get("swing_light_actual_kv", light_std)

    best_shift = 0.0
    best_error = float("inf")

    shift = -5.0
    while shift <= 5.0:
        mod_coa = dict(coa)
        mod_coa["swing_heavy_actual_kv"] = heavy_actual * (1 + shift * 0.01)
        mod_coa["swing_light_actual_kv"] = light_actual * (1 - shift * 0.005)
        kv = predict_blend_kv(profile, mod_coa)
        err = abs(kv - target_kv)
        if err < best_error:
            best_error = err
            best_shift = shift
        shift = round(shift + 0.05, 2)

    achievable = best_error < target_kv * 0.02
    if not achievable:
        return {
            "applied": False,
            "shift_delta": 0.0,
            "predicted_kv_before": round(pred_kv_before, 3),
            "achieved_kv": round(pred_kv_before + best_error, 3),
            "in_spec": False,
            "message": "⚠ Out of spec — rebalance engine could not correct",
        }

    mod_coa = dict(coa)
    mod_coa["swing_heavy_actual_kv"] = heavy_actual * (1 + best_shift * 0.01)
    mod_coa["swing_light_actual_kv"] = light_actual * (1 - best_shift * 0.005)
    achieved_kv = predict_blend_kv(profile, mod_coa)

    sign = "+" if best_shift >= 0 else ""
    return {
        "applied": True,
        "shift_delta": round(best_shift, 2),
        "predicted_kv_before": round(pred_kv_before, 3),
        "achieved_kv": round(achieved_kv, 3),
        "in_spec": True,
        "message": f"⚙ Rebalanced: swing shift {sign}{best_shift:.2f} pp",
    }


# ── Savings calculation ───────────────────────────────────────────────────────

def calculate_batch_savings(profile: dict, coa: dict, batch_mt: float, rebalance: dict) -> dict[str, Any]:
    """
    Compute all three savings streams for a single batch.
    Returns full derivation with per-stream breakdown and step trace.
    """
    additive_cost = profile["additive_cost_mt"]
    base_oil_cost = profile["base_oil_cost_mt"]
    topup_pct = profile["topup_pct"]
    cost_diff = additive_cost - base_oil_cost

    in_spec = rebalance.get("in_spec", False)

    # Stream 1 – Material Avoidance
    avoided_rate_per_mt = (topup_pct / 100) * cost_diff
    material_avoided = avoided_rate_per_mt * batch_mt if in_spec else 0.0

    # Stream 2 – Elemental Potency
    additive_comp = next((c for c in profile.get("components", []) if c["role"] == "additive"), None)
    additive_mass_frac = (additive_comp["mass_pct"] / 100.0) if additive_comp else 0.13
    overages: list[float] = []
    if additive_comp:
        for el, actual_key in [("std_ca", "additive_actual_ca"), ("std_zn", "additive_actual_zn"), ("std_p", "additive_actual_p")]:
            std = additive_comp.get(el)
            actual = coa.get(actual_key)
            if std and actual and std > 0:
                overages.append((actual - std) / std)

    avg_overage = sum(overages) / len(overages) if overages else 0.0
    reducible_frac = max(0.0, min(avg_overage, topup_pct / 100))
    elemental_saving = reducible_frac * additive_mass_frac * batch_mt * cost_diff

    # Stream 3 – RFT Lift
    current_rft = profile["current_rft_pct"] / 100.0
    rft_gap = max(0.0, (RFT_TARGET - current_rft) / (RFT_TARGET - RFT_BASELINE))
    rft_lifted = RFT_RATE_PER_MT * batch_mt * rft_gap if in_spec else 0.0

    total_saving = material_avoided + elemental_saving + rft_lifted

    steps = [
        f"step 1 · additive cost penalty = ${additive_cost:.0f} − ${base_oil_cost:.0f} = ${cost_diff:.0f}/MT",
        f"step 2 · avoided top-up rate = {topup_pct}% × ${cost_diff:.0f} = ${avoided_rate_per_mt:.2f}/MT",
        f"step 3a · rebalance saving = ${avoided_rate_per_mt:.2f}/MT × {batch_mt:.1f} MT = ${material_avoided:.0f}",
        f"step 3b · elemental potency saving = avg overage {avg_overage*100:.1f}% → ${elemental_saving:.0f}",
        f"step 4 · RFT lift = ${RFT_RATE_PER_MT}/MT × {batch_mt:.1f} MT × {rft_gap*100:.1f}% gap = ${rft_lifted:.0f}",
        f"step 5 · TOTAL = ${material_avoided:.0f} + ${elemental_saving:.0f} + ${rft_lifted:.0f} = ${total_saving:.0f}",
    ]

    return {
        "additive_cost_diff": round(cost_diff, 2),
        "topup_rate": round(avoided_rate_per_mt, 4),
        "material_avoided_per_mt": round(avoided_rate_per_mt if in_spec else 0.0, 4),
        "material_avoided": round(material_avoided, 2),
        "avg_elemental_overage": round(avg_overage, 4),
        "reducible_frac": round(reducible_frac, 4),
        "elemental_saving": round(elemental_saving, 2),
        "rft_gap": round(rft_gap, 4),
        "rft_lift_per_mt": RFT_RATE_PER_MT,
        "rft_lifted": round(rft_lifted, 2),
        "total_saving": round(total_saving, 2),
        "steps": steps,
    }


# ── Portfolio projection ──────────────────────────────────────────────────────

def compute_portfolio_scenarios(ledger: list[dict], lube_profiles: list[dict]) -> dict[str, Any]:
    """
    Project 30-day captured savings to annual with three scenarios.
    """
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(days=BATCH_DAYS_BACK)
    recent = [r for r in ledger if datetime.fromisoformat(r.get("batch_date", "2000-01-01")) >= cutoff]

    def sum_streams(recs: list[dict]) -> dict:
        m = e = r = cap = 0.0
        for rec in recs:
            s = rec.get("savings", {})
            m   += s.get("material_avoided", 0)
            e   += s.get("elemental_saving", 0)
            r   += s.get("rft_lifted", 0)
            cap += 2  # 2 hrs per batch
        return {"material": m, "elemental": e, "rft": r, "total": m + e + r, "capacity_hours": cap}

    captured = sum_streams(recent)
    annual_factor = 365.0 / BATCH_DAYS_BACK

    annual_mt = sum(p["batch_kl"] * p["density"] * p["batches_per_year"] for p in lube_profiles)
    material_annual_cost = annual_mt * (0.875 * 850 + 0.125 * 2500)

    def scenario(mult: float) -> dict:
        total = captured["total"] * annual_factor * mult
        pct = (total / material_annual_cost * 100) if material_annual_cost > 0 else 0
        return {
            "material": round(captured["material"] * annual_factor * mult, 2),
            "elemental": round(captured["elemental"] * annual_factor * mult, 2),
            "rft": round(captured["rft"] * annual_factor * mult, 2),
            "total": round(total, 2),
            "capacity_hours": round(captured["capacity_hours"] * annual_factor * mult, 1),
            "savings_as_material_pct": round(pct, 2),
        }

    captured_scenario = {
        "material": round(captured["material"], 2),
        "elemental": round(captured["elemental"], 2),
        "rft": round(captured["rft"], 2),
        "total": round(captured["total"], 2),
        "capacity_hours": round(captured["capacity_hours"], 1),
        "savings_as_material_pct": round((captured["total"] / material_annual_cost * 100) if material_annual_cost > 0 else 0, 2),
    }

    return {
        "conservative": scenario(SCENARIO_MULTIPLIERS["conservative"]),
        "expected":     scenario(SCENARIO_MULTIPLIERS["expected"]),
        "optimistic":   scenario(SCENARIO_MULTIPLIERS["optimistic"]),
        "captured_last_30d": captured_scenario,
        "annual_mt": round(annual_mt, 1),
        "lube_count": len(set(r.get("lube_id") for r in recent)),
        "batch_count": len(recent),
    }
