from typing import Protocol

from app.domain.entities import Completion, ModelCatalog


class LanguageModel(Protocol):
    """What the application needs from a local completion model. Ollama is one implementation."""

    async def list_models(self) -> ModelCatalog: ...

    async def complete(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> Completion: ...
