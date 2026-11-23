from app.application.ports import LanguageModel
from app.domain.entities import Completion

PING_PROMPT = "Reply with exactly this word and nothing else: connected"


class CompletePrompt:
    def __init__(self, language_model: LanguageModel, default_model: str) -> None:
        self._language_model = language_model
        self._default_model = default_model

    async def execute(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> Completion:
        return await self._language_model.complete(
            prompt,
            model=model or self._default_model,
            temperature=temperature,
            max_tokens=max_tokens,
        )


class PingModel:
    """Short completion used to prove the configured model can actually answer."""

    def __init__(self, complete_prompt: CompletePrompt) -> None:
        self._complete_prompt = complete_prompt

    async def execute(self) -> Completion:
        return await self._complete_prompt.execute(PING_PROMPT, temperature=0, max_tokens=8)
