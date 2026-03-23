from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.database import Base


class BlendBatch(Base):
    __tablename__ = "blend_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(20), nullable=False, unique=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=True)
    stage = Column(String(20), nullable=False, default="queued")  # queued/mixing/sampling/lab/completed/failed
    temperature_c = Column(Float, nullable=False, default=75.0)
    mixing_speed_rpm = Column(Float, nullable=False, default=120.0)
    progress_pct = Column(Float, nullable=False, default=0.0)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    volume_liters = Column(Float, nullable=False, default=10000.0)
    alerts = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
