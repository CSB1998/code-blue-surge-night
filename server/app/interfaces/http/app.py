from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.application.check_model import CheckModelStatus
from app.application.complete import CompletePrompt, PingModel
from app.domain.errors import ModelRequestFailed, ModelUnreachable
from app.infrastructure.config import Settings, load_settings
from app.infrastructure.ollama import OllamaLanguageModel
from app.interfaces.http.routes import router


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    language_model = OllamaLanguageModel(settings.ollama_host, settings.ollama_model)
    complete_prompt = CompletePrompt(language_model, settings.ollama_model)

    app = FastAPI(title="Code Blue Surge Night", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.check_model = CheckModelStatus(language_model)
    app.state.complete_prompt = complete_prompt
    app.state.ping_model = PingModel(complete_prompt)
    app.include_router(router)

    @app.exception_handler(ModelUnreachable)
    async def unreachable(_request, exc: ModelUnreachable) -> JSONResponse:
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.exception_handler(ModelRequestFailed)
    async def failed(_request, exc: ModelRequestFailed) -> JSONResponse:
        return JSONResponse(status_code=502, content={"detail": str(exc)})

    return app
