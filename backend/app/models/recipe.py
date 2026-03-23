from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    base_oil_pct = Column(Float, nullable=False, default=75.0)
    viscosity_modifier_pct = Column(Float, nullable=False, default=8.0)
    antioxidant_pct = Column(Float, nullable=False, default=3.0)
    detergent_pct = Column(Float, nullable=False, default=5.0)
    pour_point_depressant_pct = Column(Float, nullable=False, default=2.0)
    predicted_viscosity = Column(Float, nullable=True)
    predicted_flash_point = Column(Float, nullable=True)
    predicted_tbn = Column(Float, nullable=True)
    cost_per_liter = Column(Float, nullable=True)
    quality_score = Column(Float, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
