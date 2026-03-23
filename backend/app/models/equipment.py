from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Equipment(Base):
    __tablename__ = "equipment"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False, unique=True)
    type = Column(String(50), nullable=False)
    health_pct = Column(Float, nullable=False, default=95.0)  # 0-100
    status = Column(String(20), nullable=False, default="idle")  # running/idle/warning/failed
    last_maintenance = Column(DateTime(timezone=True), nullable=True)
    next_maintenance_due = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
