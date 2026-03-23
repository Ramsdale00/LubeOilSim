from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    material = Column(String(100), nullable=False)
    price_per_liter = Column(Float, nullable=False)
    lead_time_days = Column(Integer, nullable=False, default=7)
    quality_grade = Column(String(1), nullable=False, default="B")  # A/B/C
    reliability_score = Column(Float, nullable=False, default=0.85)  # 0.0 to 1.0
    is_preferred = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
