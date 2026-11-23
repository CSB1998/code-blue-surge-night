from fastapi import APIRouter, Depends, Request

from app.application.check_model import CheckModelStatus
from app.application.complete import CompletePrompt, PingModel
from app.interfaces.http.schemas import (
    GenerateRequest,
    GenerateResponse,
    ModelStatusResponse,
    PingResponse,
)

router = APIRouter()


def get_check_model(request: Request) -> CheckModelStatus:
    return request.app.state.check_model


def get_complete_prompt(request: Request) -> CompletePrompt:
    return request.app.state.complete_prompt


def get_ping_model(request: Request) -> PingModel:
    return request.app.state.ping_model


@router.get("/health")
async def health() -> dict[str, bool]:
    return {"ok": True}


@router.get("/ollama/status", response_model=ModelStatusResponse)
async def ollama_status(check_model: CheckModelStatus = Depends(get_check_model)) -> ModelStatusResponse:
    catalog = await check_model.execute()
    return ModelStatusResponse(
        ollama_host=catalog.host,
        model=catalog.configured_model,
        reachable=True,
        model_present=catalog.model_present,
        models=list(catalog.installed),
    )


@router.post("/ollama/ping", response_model=PingResponse)
async def ollama_ping(ping_model: PingModel = Depends(get_ping_model)) -> PingResponse:
    completion = await ping_model.execute()
    return PingResponse(
        model=completion.model,
        response=completion.text,
        done=completion.done,
        total_duration_ns=completion.total_duration_ns,
    )


@router.post("/ollama/generate", response_model=GenerateResponse)
async def ollama_generate(
    body: GenerateRequest,
    complete_prompt: CompletePrompt = Depends(get_complete_prompt),
) -> GenerateResponse:
    completion = await complete_prompt.execute(body.prompt, model=body.model)
    return GenerateResponse(model=completion.model, response=completion.text, done=completion.done)
