from dataclasses import dataclass


@dataclass(frozen=True)
class ModelCatalog:
    """Which models the local language-model server currently has installed."""

    host: str
    configured_model: str
    installed: tuple[str, ...]

    @property
    def model_present(self) -> bool:
        wanted = self.configured_model
        return any(name == wanted or name.startswith(f"{wanted}:") for name in self.installed)


@dataclass(frozen=True)
class Completion:
    model: str
    text: str
    done: bool
    total_duration_ns: int | None = None
