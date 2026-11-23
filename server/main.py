"""FastAPI backend for Code Blue: Surge Night.

Talks to a local Ollama server. Default model is stable-beluga, which only
exposes the completion API (POST /api/generate), not chat.
"""

import os
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "stable-beluga")

app = FastAPI(title="Code Blue Surge Night", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str | None = None


def _model_matches(name: str, wanted: str) -> bool:
    return name == wanted or name.startswith(f"{wanted}:")


async def _ollama_get(path: str, timeout: float = 10) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"{OLLAMA_HOST}{path}")
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable at {OLLAMA_HOST}: {exc}") from exc


async def _ollama_post(path: str, payload: dict[str, Any], timeout: float) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(f"{OLLAMA_HOST}{path}", json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text
        raise HTTPException(
            status_code=502,
            detail=f"Ollama returned {exc.response.status_code}: {detail}",
        ) from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail=f"Ollama unreachable at {OLLAMA_HOST}: {exc}") from exc


@app.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@app.get("/ollama/status")
async def ollama_status() -> dict[str, Any]:
    """Confirm the backend can reach Ollama and that the configured model is installed."""
    data = await _ollama_get("/api/tags")
    names = [model.get("name", "") for model in data.get("models", [])]
    return {
        "ollama_host": OLLAMA_HOST,
        "model": OLLAMA_MODEL,
        "reachable": True,
        "model_present": any(_model_matches(name, OLLAMA_MODEL) for name in names),
        "models": names,
    }


@app.post("/ollama/ping")
async def ollama_ping() -> dict[str, Any]:
    """Run a tiny completion so we know the model actually answers, not just that the daemon is up."""
    body = await _ollama_post(
        "/api/generate",
        {
            "model": OLLAMA_MODEL,
            "prompt": "Reply with exactly this word and nothing else: connected",
            "stream": False,
            "options": {"temperature": 0, "num_predict": 8},
        },
        timeout=180,
    )
    return {
        "model": body.get("model", OLLAMA_MODEL),
        "response": (body.get("response") or "").strip(),
        "done": bool(body.get("done")),
        "total_duration_ns": body.get("total_duration"),
    }


@app.post("/ollama/generate")
async def ollama_generate(request: GenerateRequest) -> dict[str, Any]:
    model = request.model or OLLAMA_MODEL
    body = await _ollama_post(
        "/api/generate",
        {
            "model": model,
            "prompt": request.prompt,
            "stream": False,
        },
        timeout=180,
    )
    return {
        "model": body.get("model", model),
        "response": (body.get("response") or "").strip(),
        "done": bool(body.get("done")),
    }
