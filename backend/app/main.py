from contextlib import asynccontextmanager
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, AsyncSessionLocal
from app.api.router import api_router
from app.api.websocket import websocket_endpoint
from app.simulation.seed_data import seed_database
from app.simulation.engine import SimulationEngine


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # 1. Initialise database (create all tables)
    await init_db()

    # 2. Create Redis connection pool
    redis_client = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=20,
    )
    app.state.redis = redis_client

    # 3. Seed database with initial data if empty
    async with AsyncSessionLocal() as db:
        await seed_database(db)

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
