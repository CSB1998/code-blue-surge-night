class OllamaError(Exception):
    """A language-model call failed."""


class ModelUnreachable(OllamaError):
    def __init__(self, host: str, reason: str) -> None:
        self.host = host
        super().__init__(f"Ollama unreachable at {host}: {reason}")


class ModelRequestFailed(OllamaError):
    def __init__(self, status_code: int, body: str) -> None:
        self.status_code = status_code
        super().__init__(f"Ollama returned {status_code}: {body}")
