from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.recipe import Recipe
from app.ml.quality_predictor import QualityPredictor
from app.ml.recipe_optimizer import RecipeOptimizer

router = APIRouter(prefix="/recipes", tags=["recipes"])

# Module-level ML singletons
_predictor = QualityPredictor()
_optimizer = RecipeOptimizer()


class RecipeResponse(BaseModel):
    id: int
    name: str
    base_oil_pct: float
    viscosity_modifier_pct: float
    antioxidant_pct: float
    detergent_pct: float
    pour_point_depressant_pct: float
    predicted_viscosity: Optional[float]
    predicted_flash_point: Optional[float]
    predicted_tbn: Optional[float]
    cost_per_liter: Optional[float]
    quality_score: Optional[float]
    created_at: Optional[str]


class CreateRecipeRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    base_oil_pct: float = Field(..., ge=50.0, le=95.0)
    viscosity_modifier_pct: float = Field(..., ge=0.0, le=20.0)
    antioxidant_pct: float = Field(..., ge=0.0, le=10.0)
    detergent_pct: float = Field(..., ge=0.0, le=15.0)
    pour_point_depressant_pct: float = Field(..., ge=0.0, le=5.0)
    cost_per_liter: Optional[float] = None


class UpdateRecipeRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    base_oil_pct: Optional[float] = Field(None, ge=50.0, le=95.0)
    viscosity_modifier_pct: Optional[float] = Field(None, ge=0.0, le=20.0)
    antioxidant_pct: Optional[float] = Field(None, ge=0.0, le=10.0)
    detergent_pct: Optional[float] = Field(None, ge=0.0, le=15.0)
    pour_point_depressant_pct: Optional[float] = Field(None, ge=0.0, le=5.0)
    cost_per_liter: Optional[float] = None


class PredictRequest(BaseModel):
    base_oil_pct: float = Field(..., ge=50.0, le=95.0)
    viscosity_modifier_pct: float = Field(..., ge=0.0, le=20.0)
    antioxidant_pct: float = Field(..., ge=0.0, le=10.0)
    detergent_pct: float = Field(..., ge=0.0, le=15.0)
    pour_point_depressant_pct: float = Field(..., ge=0.0, le=5.0)
    temperature_c: float = Field(default=80.0, ge=40.0, le=100.0)


class SuggestRequest(BaseModel):
    mode: str = Field(default="balanced", pattern="^(cost|quality|balanced)$")


def _recipe_to_response(r: Recipe) -> RecipeResponse:
    return RecipeResponse(
        id=r.id,
        name=r.name,
        base_oil_pct=r.base_oil_pct,
        viscosity_modifier_pct=r.viscosity_modifier_pct,
        antioxidant_pct=r.antioxidant_pct,
        detergent_pct=r.detergent_pct,
        pour_point_depressant_pct=r.pour_point_depressant_pct,
        predicted_viscosity=r.predicted_viscosity,
        predicted_flash_point=r.predicted_flash_point,
        predicted_tbn=r.predicted_tbn,
        cost_per_liter=r.cost_per_liter,
        quality_score=r.quality_score,
        created_at=r.created_at.isoformat() if r.created_at else None,
    )


@router.get("", response_model=list[RecipeResponse])
async def list_recipes(db: AsyncSession = Depends(get_db)) -> list[RecipeResponse]:
    """Return all recipes."""
    recipes = (await db.execute(select(Recipe).order_by(Recipe.id))).scalars().all()
    return [_recipe_to_response(r) for r in recipes]


@router.get("/compare", response_model=list[RecipeResponse])
async def compare_recipes(
    ids: str = Query(..., description="Comma-separated recipe IDs to compare"),
    db: AsyncSession = Depends(get_db),
) -> list[RecipeResponse]:
    """Compare multiple recipes side by side."""
    try:
        id_list = [int(i.strip()) for i in ids.split(",") if i.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid recipe IDs — provide comma-separated integers")

    if not id_list:
        raise HTTPException(status_code=400, detail="No recipe IDs provided")

    recipes = (
        await db.execute(select(Recipe).where(Recipe.id.in_(id_list)))
    ).scalars().all()
    return [_recipe_to_response(r) for r in recipes]


@router.get("/{recipe_id}", response_model=RecipeResponse)
async def get_recipe(recipe_id: int, db: AsyncSession = Depends(get_db)) -> RecipeResponse:
    """Return a single recipe by ID."""
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail=f"Recipe {recipe_id} not found")
    return _recipe_to_response(recipe)


@router.post("", response_model=RecipeResponse, status_code=201)
async def create_recipe(
    body: CreateRecipeRequest, db: AsyncSession = Depends(get_db)
) -> RecipeResponse:
    """Create a new recipe with predicted properties."""
    # Check unique name
    existing = await db.execute(select(Recipe).where(Recipe.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Recipe '{body.name}' already exists")

    prediction = _predictor.predict(
        body.base_oil_pct, body.viscosity_modifier_pct, body.antioxidant_pct,
        body.detergent_pct, body.pour_point_depressant_pct
    )

    recipe = Recipe(
        name=body.name,
        base_oil_pct=body.base_oil_pct,
        viscosity_modifier_pct=body.viscosity_modifier_pct,
        antioxidant_pct=body.antioxidant_pct,
        detergent_pct=body.detergent_pct,
        pour_point_depressant_pct=body.pour_point_depressant_pct,
        predicted_viscosity=prediction["viscosity"],
        predicted_flash_point=prediction["flash_point"],
        predicted_tbn=prediction["tbn"],
        cost_per_liter=body.cost_per_liter,
        quality_score=round(100.0 - prediction["off_spec_risk"], 1),
    )
    db.add(recipe)
    await db.flush()
    await db.refresh(recipe)
    return _recipe_to_response(recipe)


@router.put("/{recipe_id}", response_model=RecipeResponse)
async def update_recipe(
    recipe_id: int,
    body: UpdateRecipeRequest,
    db: AsyncSession = Depends(get_db),
) -> RecipeResponse:
    """Update a recipe and recalculate predicted properties."""
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail=f"Recipe {recipe_id} not found")

    if body.name is not None:
        recipe.name = body.name
    if body.base_oil_pct is not None:
        recipe.base_oil_pct = body.base_oil_pct
    if body.viscosity_modifier_pct is not None:
        recipe.viscosity_modifier_pct = body.viscosity_modifier_pct
    if body.antioxidant_pct is not None:
        recipe.antioxidant_pct = body.antioxidant_pct
    if body.detergent_pct is not None:
        recipe.detergent_pct = body.detergent_pct
    if body.pour_point_depressant_pct is not None:
        recipe.pour_point_depressant_pct = body.pour_point_depressant_pct
    if body.cost_per_liter is not None:
        recipe.cost_per_liter = body.cost_per_liter

    # Recalculate predictions
    prediction = _predictor.predict(
        recipe.base_oil_pct, recipe.viscosity_modifier_pct, recipe.antioxidant_pct,
        recipe.detergent_pct, recipe.pour_point_depressant_pct
    )
    recipe.predicted_viscosity = prediction["viscosity"]
    recipe.predicted_flash_point = prediction["flash_point"]
    recipe.predicted_tbn = prediction["tbn"]
    recipe.quality_score = round(100.0 - prediction["off_spec_risk"], 1)

    await db.flush()
    await db.refresh(recipe)
    return _recipe_to_response(recipe)


@router.delete("/{recipe_id}", status_code=204)
async def delete_recipe(recipe_id: int, db: AsyncSession = Depends(get_db)) -> None:
    """Delete a recipe."""
    result = await db.execute(select(Recipe).where(Recipe.id == recipe_id))
    recipe = result.scalar_one_or_none()
    if not recipe:
        raise HTTPException(status_code=404, detail=f"Recipe {recipe_id} not found")
    await db.delete(recipe)


@router.post("/predict")
async def predict_quality(body: PredictRequest) -> dict:
    """Predict quality properties for given ingredient percentages."""
    return _predictor.predict(
        body.base_oil_pct,
        body.viscosity_modifier_pct,
        body.antioxidant_pct,
        body.detergent_pct,
        body.pour_point_depressant_pct,
        body.temperature_c,
    )


@router.post("/suggest")
async def suggest_recipe(body: SuggestRequest, db: AsyncSession = Depends(get_db)) -> dict:
    """Use AI optimizer to suggest an optimized recipe."""
    suggestion = _optimizer.suggest(mode=body.mode)

    # Get cross-recipe suggestions
    recipes = (await db.execute(select(Recipe))).scalars().all()
    recipe_dicts = [
        {
            "base_oil_pct": r.base_oil_pct,
            "viscosity_modifier_pct": r.viscosity_modifier_pct,
            "antioxidant_pct": r.antioxidant_pct,
            "detergent_pct": r.detergent_pct,
            "pour_point_depressant_pct": r.pour_point_depressant_pct,
            "quality_score": r.quality_score,
        }
        for r in recipes
    ]
    cross_suggestions = _optimizer.cross_recipe_suggestions(recipe_dicts)

    return {
        "suggestion": suggestion,
        "cross_recipe_insights": cross_suggestions,
    }
