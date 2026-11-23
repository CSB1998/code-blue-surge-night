import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    ollama_host: str
    ollama_model: str
    cors_origins: tuple[str, ...]


def load_settings() -> Settings:
    return Settings(
        ollama_host=os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/"),
        ollama_model=os.getenv("OLLAMA_MODEL", "stable-beluga"),
        cors_origins=(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ),
    )
