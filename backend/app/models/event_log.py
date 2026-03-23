from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.database import Base


class EventLog(Base):
    __tablename__ = "event_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    severity = Column(String(20), nullable=False, default="info")  # info/warning/critical
    category = Column(String(30), nullable=False, default="blend")  # blend/tank/equipment/quality/supply
    message = Column(String(500), nullable=False)
    resolved = Column(Boolean, nullable=False, default=False)
