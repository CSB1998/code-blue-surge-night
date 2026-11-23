from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    prompt: str = Field(min_length=1)
    model: str | None = None


class ModelStatusResponse(BaseModel):
    ollama_host: str
    model: str
    reachable: bool
    model_present: bool
    models: list[str]


class PingResponse(BaseModel):
    model: str
    response: str
    done: bool
    total_duration_ns: int | None


class GenerateResponse(BaseModel):
    model: str
    response: str
    done: bool
