from typing import Any


class SupplyOptimizer:
    """Optimises supplier selection by ranking on weighted cost/quality/reliability."""

    def optimize(
        self,
        requirements: dict[str, Any],
        suppliers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        Rank suppliers by weighted combination of price, quality, and reliability.
        Returns ranked list with allocation percentages and total cost.
        """
        volume_liters = requirements.get("volume_liters", 10000.0)
        priority = requirements.get("priority", "balanced")  # cost / quality / speed / balanced

        if not suppliers:
            return {
                "ranked_suppliers": [],
                "recommended_allocation": {},
                "total_cost": 0.0,
                "savings_vs_worst": 0.0,
            }

        # Build numeric scores
        prices = [s.get("price_per_liter", 1.0) for s in suppliers]
        leads = [s.get("lead_time_days", 7) for s in suppliers]
        reliabilities = [s.get("reliability_score", 0.85) for s in suppliers]

        grade_map = {"A": 1.0, "B": 0.7, "C": 0.4}

        price_min, price_max = min(prices), max(prices)
        lead_min, lead_max = min(leads), max(leads)

        def safe_norm(val, vmin, vmax, higher_better: bool = True) -> float:
            if vmax == vmin:
                return 1.0
            ratio = (val - vmin) / (vmax - vmin)
            return (1.0 - ratio) if higher_better else ratio

        if priority == "cost":
            w_price, w_lead, w_quality, w_reliability = 0.50, 0.15, 0.20, 0.15
        elif priority == "quality":
            w_price, w_lead, w_quality, w_reliability = 0.15, 0.15, 0.50, 0.20
        elif priority == "speed":
            w_price, w_lead, w_quality, w_reliability = 0.20, 0.50, 0.15, 0.15
        else:
            w_price, w_lead, w_quality, w_reliability = 0.30, 0.25, 0.25, 0.20

        ranked = []
        for s in suppliers:
            price_score = safe_norm(s.get("price_per_liter", 1.0), price_min, price_max, higher_better=True)
            lead_score = safe_norm(s.get("lead_time_days", 7), lead_min, lead_max, higher_better=True)
            quality_score = grade_map.get(s.get("quality_grade", "B"), 0.7)
            reliability_score = s.get("reliability_score", 0.85)

            composite = (
                price_score * w_price
                + lead_score * w_lead
                + quality_score * w_quality
                + reliability_score * w_reliability
            )

            entry = dict(s)
            entry["composite_score"] = round(composite, 4)
            entry["total_cost"] = round(s.get("price_per_liter", 1.0) * volume_liters, 2)
            entry["allocation_pct"] = 0
            ranked.append(entry)

        ranked.sort(key=lambda x: x["composite_score"], reverse=True)

        for i, s in enumerate(ranked):
            s["rank"] = i + 1

        # Allocate order: top supplier gets 70%, second gets 30%
        if len(ranked) >= 2:
            ranked[0]["allocation_pct"] = 70
            ranked[1]["allocation_pct"] = 30
        elif ranked:
            ranked[0]["allocation_pct"] = 100

        # Calculate blended total cost
        blended_cost = round(
            sum(
                r.get("price_per_liter", 1.0) * (r.get("allocation_pct", 0) / 100.0) * volume_liters
                for r in ranked
            ),
            2,
        )

        worst_cost = ranked[-1]["total_cost"] if ranked else 0.0
        savings = round(worst_cost - blended_cost, 2)

        recommended_allocation = {
            r["name"]: r["allocation_pct"] for r in ranked if r["allocation_pct"] > 0
        }

        return {
            "ranked_suppliers": ranked,
            "recommended_allocation": recommended_allocation,
            "total_cost": blended_cost,
            "savings_vs_worst": max(0.0, savings),
            "priority_mode": priority,
        }
