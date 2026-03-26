import asyncio
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Callable

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.api.router import api_router
from app.api.websocket import websocket_endpoint
from app.simulation.seed_data import seed_database
from app.simulation.engine import SimulationEngine

logger = logging.getLogger(__name__)


async def _retry(coro_factory: Callable, label: str, retries: int = 8, base_delay: float = 2.0) -> None:
    """Retry an async operation with linear backoff. Raises on final failure."""
    for attempt in range(1, retries + 1):
        try:
            await coro_factory()
            return
        except Exception as exc:
            if attempt == retries:
                logger.error("%s failed after %d attempts: %s", label, retries, exc)
                raise
            wait = base_delay * attempt
            logger.warning(
                "%s attempt %d/%d failed (%s). Retrying in %.0fs...",
                label, attempt, retries, exc, wait,
            )
            await asyncio.sleep(wait)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # 1. Initialise database (create all tables) — retry until DB is ready
    await _retry(init_db, "Database init")

    # 2. Create Redis connection pool
    redis_client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    app.state.redis = redis_client

    # 3. Seed database with initial data if empty — retry in case DB is still warming up
    async def _seed() -> None:
        async with AsyncSessionLocal() as db:
            await seed_database(db)

    await _retry(_seed, "Database seed")

    # 4. Initialise and start the simulation engine
    engine = SimulationEngine(
        redis_client=redis_client,
        db_session_factory=AsyncSessionLocal,
    )
    app.state.engine = engine
    await engine.start()

    yield

    # 5. Shutdown: stop simulation engine and close Redis
    await engine.stop()
    await redis_client.aclose()
    app.state.redis = None
    app.state.engine = None


app = FastAPI(
    title="LubeOilSim API",
    description="Digital twin simulator for a Lube Oil Blending Plant",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://frontend:5173",
        "http://localhost:3000",
        "http://localhost:80",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include all REST API routers under /api/v1
app.include_router(api_router)

# Mount WebSocket endpoint directly on app
app.add_api_websocket_route("/ws/{channel}", websocket_endpoint)


@app.get("/health")
async def health_check() -> dict:
    """Basic health check endpoint."""
    engine = getattr(app.state, "engine", None)
    return {
        "status": "ok",
        "simulation_running": engine.is_running if engine else False,
        "tick_count": engine.tick_count if engine else 0,
    }
