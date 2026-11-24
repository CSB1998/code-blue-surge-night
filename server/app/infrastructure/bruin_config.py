"""Read the Postgres warehouse from the repo `.bruin.yml`.

Bruin runs SQL against the connection named `codeblue`. The game writes the
same database, so agent thoughts and the rest of the decision log are what
`bruin run` turns into the analytics tables.
"""

from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

import yaml


def postgres_dsn(config_path: Path, name: str = "codeblue") -> str:
    document = yaml.safe_load(config_path.read_text())
    environment = document.get("default_environment", "default")
    connections = document["environments"][environment]["connections"]["postgres"]
    match = next((item for item in connections if item.get("name") == name), None)
    if match is None:
        raise RuntimeError(f"No postgres connection named {name} in {config_path}")
    user = quote(str(match["username"]), safe="")
    password = quote(str(match["password"]), safe="")
    host = match["host"]
    port = match.get("port", 5432)
    database = match["database"]
    ssl_mode = match.get("ssl_mode", "require")
    return f"postgresql://{user}:{password}@{host}:{port}/{database}?sslmode={ssl_mode}"
