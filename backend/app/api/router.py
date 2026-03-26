from fastapi import APIRouter

from app.api.dashboard import router as dashboard_router
from app.api.blends import router as blends_router
from app.api.tanks import router as tanks_router
from app.api.recipes import router as recipes_router
from app.api.quality import router as quality_router
from app.api.supply import router as supply_router
from app.api.equipment import router as equipment_router
from app.api.ai_panel import router as ai_router
from app.api.simulation_control import router as simulation_router
from app.api.document_assistant import router as doc_assistant_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(dashboard_router)
api_router.include_router(blends_router)
api_router.include_router(tanks_router)
api_router.include_router(recipes_router)
api_router.include_router(quality_router)
api_router.include_router(supply_router)
api_router.include_router(equipment_router)
api_router.include_router(ai_router)
api_router.include_router(simulation_router)
api_router.include_router(doc_assistant_router)
