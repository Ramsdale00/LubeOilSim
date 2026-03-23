from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://sim:simpass@postgres:5432/luboilsim"
    redis_url: str = "redis://redis:6379/0"
    celery_broker_url: str = "redis://redis:6379/1"
    celery_result_backend: str = "redis://redis:6379/1"
    simulation_tick_interval: float = 2.0
    time_acceleration: int = 1

    model_config = {"env_prefix": "LUBOIL_", "case_sensitive": False}


settings = Settings()
