from typing import Any

import httpx

from app.domain.entities import Completion, ModelCatalog
from app.domain.errors import ModelRequestFailed, ModelUnreachable


class OllamaLanguageModel:
    """Ollama completion API. stable-beluga exposes /api/generate, not chat."""

    def __init__(self, host: str, default_model: str) -> None:
        self._host = host.rstrip("/")
        self._default_model = default_model

    async def list_models(self) -> ModelCatalog:
        data = await self._get("/api/tags")
        names = tuple(model.get("name", "") for model in data.get("models", []))
        return ModelCatalog(host=self._host, configured_model=self._default_model, installed=names)

    async def complete(
        self,
        prompt: str,
        *,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> Completion:
        options: dict[str, Any] = {}
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            options["num_predict"] = max_tokens
        payload: dict[str, Any] = {
            "model": model or self._default_model,
            "prompt": prompt,
            "stream": False,
        }
        if options:
            payload["options"] = options
        body = await self._post("/api/generate", payload, timeout=180)
        return Completion(
            model=body.get("model", payload["model"]),
            text=(body.get("response") or "").strip(),
            done=bool(body.get("done")),
            total_duration_ns=body.get("total_duration"),
        )

    async def _get(self, path: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(f"{self._host}{path}")
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            raise ModelRequestFailed(exc.response.status_code, exc.response.text) from exc
        except httpx.HTTPError as exc:
            raise ModelUnreachable(self._host, str(exc)) from exc

    async def _post(self, path: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                response = await client.post(f"{self._host}{path}", json=payload)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            raise ModelRequestFailed(exc.response.status_code, exc.response.text) from exc
        except httpx.HTTPError as exc:
            raise ModelUnreachable(self._host, str(exc)) from exc
