from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Tank(Base):
    __tablename__ = "tanks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), nullable=False, unique=True)
    material = Column(String(100), nullable=False)
    capacity_liters = Column(Float, nullable=False, default=50000.0)
    current_level = Column(Float, nullable=False, default=0.7)  # 0.0 to 1.0
    temperature_c = Column(Float, nullable=False, default=60.0)
    status = Column(String(20), nullable=False, default="normal")  # normal/low/critical/offline
    position_x = Column(Float, nullable=False, default=0.0)
    position_y = Column(Float, nullable=False, default=0.0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
