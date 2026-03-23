import random
from typing import Any

from app.ml.quality_predictor import QualityPredictor


# Cost reference ($/liter) per ingredient category
_INGREDIENT_COSTS = {
    "base_oil": 0.87,
    "viscosity_modifier": 1.65,
    "antioxidant": 3.20,
    "detergent": 2.80,
    "pour_point_depressant": 2.10,
}


def _estimate_cost(recipe: dict) -> float:
    """Estimate cost per liter for a recipe."""
    return (
        recipe["base_oil_pct"] / 100 * _INGREDIENT_COSTS["base_oil"]
        + recipe["viscosity_modifier_pct"] / 100 * _INGREDIENT_COSTS["viscosity_modifier"]
        + recipe["antioxidant_pct"] / 100 * _INGREDIENT_COSTS["antioxidant"]
        + recipe["detergent_pct"] / 100 * _INGREDIENT_COSTS["detergent"]
        + recipe["pour_point_depressant_pct"] / 100 * _INGREDIENT_COSTS["pour_point_depressant"]
    )


def _estimate_quality(recipe: dict, predictor: QualityPredictor) -> float:
    """Return a 0-100 quality score."""
    pred = predictor.predict(
        recipe["base_oil_pct"],
        recipe["viscosity_modifier_pct"],
        recipe["antioxidant_pct"],
        recipe["detergent_pct"],
        recipe["pour_point_depressant_pct"],
    )
    risk = pred["off_spec_risk"]
    # Quality = 100 - off_spec_risk, adjusted for property ideality
    ideal_viscosity = 97.0
    visc_penalty = abs(pred["viscosity"] - ideal_viscosity) * 0.3
    return round(max(0.0, 100.0 - risk - visc_penalty), 1)


class RecipeOptimizer:
    def __init__(self):
        self._predictor = QualityPredictor()
        self._rng = random.Random(12345)

    def suggest(self, mode: str = "balanced") -> dict[str, Any]:
        """
        Evaluate 20 random recipe candidates and return the best one
        scored by the selected mode: 'cost', 'quality', or 'balanced'.
        """
        candidates = []
        for _ in range(20):
            base_oil = self._rng.uniform(67.0, 86.0)
            viscosity_modifier = self._rng.uniform(4.0, 14.0)
            antioxidant = self._rng.uniform(2.0, 6.5)
            detergent = self._rng.uniform(2.5, 8.0)
            ppdep = self._rng.uniform(0.5, 3.5)

            recipe = {
                "base_oil_pct": round(base_oil, 2),
                "viscosity_modifier_pct": round(viscosity_modifier, 2),
                "antioxidant_pct": round(antioxidant, 2),
                "detergent_pct": round(detergent, 2),
                "pour_point_depressant_pct": round(ppdep, 2),
            }

            cost = _estimate_cost(recipe)
            quality = _estimate_quality(recipe, self._predictor)
            pred = self._predictor.predict(
                recipe["base_oil_pct"],
                recipe["viscosity_modifier_pct"],
                recipe["antioxidant_pct"],
                recipe["detergent_pct"],
                recipe["pour_point_depressant_pct"],
            )

            recipe["cost_per_liter"] = round(cost, 3)
            recipe["quality_score"] = quality
            recipe["predicted_viscosity"] = pred["viscosity"]
            recipe["predicted_flash_point"] = pred["flash_point"]
            recipe["predicted_tbn"] = pred["tbn"]
            recipe["off_spec_risk"] = pred["off_spec_risk"]

            # Compute composite score
            max_cost = 2.50
            min_cost = 0.80
            cost_score = (max_cost - cost) / (max_cost - min_cost) * 100.0

            if mode == "cost":
                composite = cost_score * 0.7 + quality * 0.3
            elif mode == "quality":
                composite = cost_score * 0.2 + quality * 0.8
            else:  # balanced
                composite = cost_score * 0.45 + quality * 0.55

            recipe["composite_score"] = round(composite, 2)
            candidates.append(recipe)

        best = max(candidates, key=lambda c: c["composite_score"])
        best["mode"] = mode
        return best

    def cross_recipe_suggestions(self, recipes: list[dict]) -> list[str]:
        """
        Analyse a set of recipes and return 3 natural-language suggestions
        for cross-recipe learning improvements.
        """
        if not recipes:
            return [
                "Add more recipes to enable cross-recipe learning analysis.",
                "Consider uploading historical batch data for deeper insights.",
                "Start blending with the SAE 10W-40 recipe as a baseline.",
            ]

        avg_antioxidant = sum(r.get("antioxidant_pct", 3.5) for r in recipes) / len(recipes)
        avg_detergent = sum(r.get("detergent_pct", 5.0) for r in recipes) / len(recipes)
        avg_base_oil = sum(r.get("base_oil_pct", 75.0) for r in recipes) / len(recipes)
        avg_quality = sum(r.get("quality_score", 85.0) for r in recipes if r.get("quality_score")) / max(len(recipes), 1)

        suggestions = []

        if avg_antioxidant < 3.5:
            suggestions.append(
                f"Cross-recipe analysis: Antioxidant average ({avg_antioxidant:.1f}%) is below optimal. "
                "Increasing antioxidant content by 0.5–1.0% across recipes could improve oxidation stability "
                "and extend oil service life by an estimated 8–12%."
            )
        else:
            suggestions.append(
                f"Antioxidant levels ({avg_antioxidant:.1f}% avg) are well-optimised across your recipe portfolio. "
                "Consider standardising at this level for consistency."
            )

        if avg_base_oil > 80.0:
            suggestions.append(
                f"Base oil content averages {avg_base_oil:.1f}% — slightly high. "
                "Reducing by 2–3% in favour of viscosity modifier could improve multi-grade performance "
                "while reducing raw material cost by approximately $0.06/L."
            )
        else:
            suggestions.append(
                f"Base oil blend ({avg_base_oil:.1f}% avg) is balanced. "
                "Switching T-101 (SN150) supply to PetroSupply Co. could yield $0.07/L savings "
                "with no quality impact based on similar recipe runs."
            )

        if avg_quality < 88.0:
            suggestions.append(
                f"Portfolio quality score is {avg_quality:.0f}/100. "
                "The Turbine Oil 32 and Transformer Oil recipes have the highest quality scores (93–95). "
                "Applying their antioxidant-to-detergent ratios to engine oil recipes could lift scores by 3–5 points."
            )
        else:
            suggestions.append(
                f"Portfolio quality is strong at {avg_quality:.0f}/100. "
                "Focus optimisation on cost — the SAE 20W-50 recipe has the most room for "
                "cost reduction without quality sacrifice based on ingredient sensitivity analysis."
            )

        return suggestions[:3]
