import numpy as np
from typing import Any


class QualityPredictor:
    """
    Simulated ML quality predictor.
    Trains LinearRegression models on synthetic data for viscosity, flash_point, and TBN.
    """

    def __init__(self):
        rng = np.random.default_rng(42)

        # Generate 200-row synthetic dataset
        n = 200
        base_oil = rng.uniform(65.0, 88.0, n)
        viscosity_modifier = rng.uniform(3.0, 16.0, n)
        antioxidant = rng.uniform(1.5, 7.5, n)
        detergent = rng.uniform(2.0, 9.0, n)
        ppdep = rng.uniform(0.3, 4.0, n)
        temp = rng.uniform(70.0, 95.0, n)

        # Synthetic targets (physics-inspired formulas + noise)
        viscosity_true = (
            85.0
            + viscosity_modifier * 2.1
            - (100 - base_oil) * 0.28
            + antioxidant * 0.45
            + (temp - 80.0) * (-0.12)
            + rng.normal(0, 2.0, n)
        )
        viscosity_true = np.clip(viscosity_true, 82.0, 125.0)

        flash_point_true = (
            200.0
            + base_oil * 0.38
            - viscosity_modifier * 0.28
            + antioxidant * 0.75
            + detergent * 0.18
            + (temp - 80.0) * 0.04
            + rng.normal(0, 2.5, n)
        )
        flash_point_true = np.clip(flash_point_true, 198.0, 242.0)

        tbn_true = (
            5.5
            + detergent * 0.58
            + antioxidant * 0.33
            + viscosity_modifier * 0.04
            + rng.normal(0, 0.4, n)
        )
        tbn_true = np.clip(tbn_true, 5.0, 13.0)

        # Feature matrix
        X = np.column_stack([base_oil, viscosity_modifier, antioxidant, detergent, ppdep, temp])

        # Fit linear regression using closed-form solution (no sklearn dependency in hot path)
        X_aug = np.column_stack([np.ones(n), X])

        self._coef_viscosity = np.linalg.lstsq(X_aug, viscosity_true, rcond=None)[0]
        self._coef_flash = np.linalg.lstsq(X_aug, flash_point_true, rcond=None)[0]
        self._coef_tbn = np.linalg.lstsq(X_aug, tbn_true, rcond=None)[0]

        # Residual std for confidence intervals
        pred_visc = X_aug @ self._coef_viscosity
        pred_flash = X_aug @ self._coef_flash
        pred_tbn = X_aug @ self._coef_tbn

        self._std_viscosity = float(np.std(viscosity_true - pred_visc))
        self._std_flash = float(np.std(flash_point_true - pred_flash))
        self._std_tbn = float(np.std(tbn_true - pred_tbn))

    def predict(
        self,
        base_oil_pct: float,
        viscosity_modifier_pct: float,
        antioxidant_pct: float,
        detergent_pct: float,
        pour_point_pct: float,
        temp_c: float = 80.0,
    ) -> dict[str, Any]:
        """Predict quality properties for a given recipe."""
        x = np.array([1.0, base_oil_pct, viscosity_modifier_pct, antioxidant_pct,
                      detergent_pct, pour_point_pct, temp_c])

        viscosity = float(x @ self._coef_viscosity)
        flash_point = float(x @ self._coef_flash)
        tbn = float(x @ self._coef_tbn)

        # Clamp to realistic ranges
        viscosity = max(82.0, min(125.0, viscosity))
        flash_point = max(198.0, min(242.0, flash_point))
        tbn = max(5.0, min(13.0, tbn))

        # 90% confidence intervals (±1.645 * std)
        ci_mult = 1.645
        risk = self.off_spec_risk({
            "base_oil_pct": base_oil_pct,
            "viscosity_modifier_pct": viscosity_modifier_pct,
            "antioxidant_pct": antioxidant_pct,
            "detergent_pct": detergent_pct,
            "pour_point_depressant_pct": pour_point_pct,
        })

        return {
            "viscosity": round(viscosity, 2),
            "viscosity_ci_low": round(viscosity - ci_mult * self._std_viscosity, 2),
            "viscosity_ci_high": round(viscosity + ci_mult * self._std_viscosity, 2),
            "flash_point": round(flash_point, 2),
            "flash_point_ci_low": round(flash_point - ci_mult * self._std_flash, 2),
            "flash_point_ci_high": round(flash_point + ci_mult * self._std_flash, 2),
            "tbn": round(tbn, 2),
            "tbn_ci_low": round(tbn - ci_mult * self._std_tbn, 2),
            "tbn_ci_high": round(tbn + ci_mult * self._std_tbn, 2),
            "off_spec_risk": risk,
        }

    def off_spec_risk(self, recipe: dict, target_spec: dict | None = None) -> float:
        """
        Return 0-100 off-spec risk score.
        Higher values indicate higher probability of failing quality specifications.
        """
        if target_spec is None:
            target_spec = {
                "viscosity_min": 87.0,
                "viscosity_max": 118.0,
                "flash_point_min": 205.0,
                "tbn_min": 6.5,
            }

        base_oil = recipe.get("base_oil_pct", 75.0)
        viscosity_modifier = recipe.get("viscosity_modifier_pct", 8.0)
        antioxidant = recipe.get("antioxidant_pct", 3.5)
        detergent = recipe.get("detergent_pct", 5.0)
        ppdep = recipe.get("pour_point_depressant_pct", 2.0)

        x = np.array([1.0, base_oil, viscosity_modifier, antioxidant, detergent, ppdep, 80.0])
        viscosity = float(x @ self._coef_viscosity)
        flash_point = float(x @ self._coef_flash)
        tbn = float(x @ self._coef_tbn)

        risk = 0.0

        # Viscosity penalties
        if viscosity < target_spec.get("viscosity_min", 87.0):
            risk += min(40.0, (target_spec["viscosity_min"] - viscosity) * 4.0)
        elif viscosity > target_spec.get("viscosity_max", 118.0):
            risk += min(40.0, (viscosity - target_spec["viscosity_max"]) * 4.0)

        # Flash point penalty
        if flash_point < target_spec.get("flash_point_min", 205.0):
            risk += min(35.0, (target_spec["flash_point_min"] - flash_point) * 2.0)

        # TBN penalty
        if tbn < target_spec.get("tbn_min", 6.5):
            risk += min(25.0, (target_spec["tbn_min"] - tbn) * 8.0)

        # Formulation balance penalty (percentages far from typical)
        if base_oil < 65.0 or base_oil > 88.0:
            risk += 10.0

        return round(min(100.0, max(0.0, risk)), 1)
