import os
from dataclasses import dataclass
from pathlib import Path

from app.infrastructure.bruin_config import postgres_dsn

ROOT = Path(__file__).resolve().parents[3]
SERVER_DIR = ROOT / "server"


def _load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Settings:
    ollama_host: str
    ollama_model: str
    cors_origins: tuple[str, ...]
    database_url: str
    bruin_bin: Path
    pipeline_dir: Path
    band_config: Path


def load_settings() -> Settings:
    _load_env_file(SERVER_DIR / ".env")
    _load_env_file(ROOT / ".env")
    return Settings(
        ollama_host=os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/"),
        ollama_model=os.getenv("OLLAMA_MODEL", "stable-beluga"),
        cors_origins=(
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ),
        database_url=os.getenv("DATABASE_URL") or postgres_dsn(ROOT / ".bruin.yml"),
        bruin_bin=Path(os.getenv("BRUIN_BIN", str(Path.home() / ".local/bin/bruin"))),
        pipeline_dir=ROOT / "bruin" / "codeblue",
        band_config=ROOT / "agent_config.yaml",
    )
