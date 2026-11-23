import asyncio
import logging
from contextlib import asynccontextmanager

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.application.check_model import CheckModelStatus
from app.application.complete import CompletePrompt, PingModel
from app.domain.errors import ModelRequestFailed, ModelUnreachable
from app.infrastructure.config import Settings, load_settings
from app.infrastructure.ollama import OllamaLanguageModel
from app.infrastructure.store import DecisionLog
from app.interfaces.http.routes import router
from app.interfaces.socket.gateway import attach

log = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> socketio.ASGIApp:
    settings = settings or load_settings()
    language_model = OllamaLanguageModel(settings.ollama_host, settings.ollama_model)
    complete_prompt = CompletePrompt(language_model, settings.ollama_model)
    store = DecisionLog(settings.database_url)
    store.ensure()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        store.ensure()
        app.state.store = store
        asyncio.create_task(_warm(language_model))
        yield

    fastapi_app = FastAPI(title="Code Blue Surge Night", version="0.1.0", lifespan=lifespan)
    fastapi_app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    fastapi_app.state.check_model = CheckModelStatus(language_model)
    fastapi_app.state.complete_prompt = complete_prompt
    fastapi_app.state.ping_model = PingModel(complete_prompt)
    fastapi_app.include_router(router)

    @fastapi_app.exception_handler(ModelUnreachable)
    async def unreachable(_request, exc: ModelUnreachable) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @fastapi_app.exception_handler(ModelRequestFailed)
    async def failed(_request, exc: ModelRequestFailed) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=list(settings.cors_origins))
    attach(sio, settings, store, language_model)
    return socketio.ASGIApp(sio, other_asgi_app=fastapi_app)


async def _warm(model: OllamaLanguageModel) -> None:
    try:
        await model.complete("### User:\nSay ready.\n### Assistant:\n", temperature=0, max_tokens=4)
        log.info("ollama model is warm")
    except Exception as exc:
        log.info("ollama warmup skipped: %s", exc)
