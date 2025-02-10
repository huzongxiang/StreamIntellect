from typing import Optional
from pydantic_settings import BaseSettings

class DBSettings(BaseSettings):
    SQLITE_URL: str = "sqlite+aiosqlite:///./ai_platform.db"
    ECHO_SQL: bool = True
    
    class Config:
        env_file = ".env"

db_settings = DBSettings() 