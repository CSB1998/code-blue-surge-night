from app.application.ports import LanguageModel
from app.domain.entities import ModelCatalog


class CheckModelStatus:
    def __init__(self, language_model: LanguageModel) -> None:
        self._language_model = language_model

    async def execute(self) -> ModelCatalog:
        return await self._language_model.list_models()
