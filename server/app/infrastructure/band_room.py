"""Agent collaboration room.

Kim, Raj, Okafor, and Reyes hand work to each other with @mentions. The room is
the BAND seam: every whisper and spoken decision is recorded as a mention.
When agent_config.yaml has BAND agent keys, those mentions are also posted to
BAND. A LangGraph adapter can replace `publish` later without changing the sim.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import httpx
import yaml

from app.infrastructure.store import DecisionLog

log = logging.getLogger(__name__)

BAND_MESSAGES = "https://api.band.ai/v1/messages"


class BandRoom:
    def __init__(self, run_id: str, store: DecisionLog, config_path: Path) -> None:
        self.run_id = run_id
        self.store = store
        self.agents = _load_agents(config_path)

    async def spoken(self, payload: dict[str, Any]) -> None:
        mentions = _mentions(payload["spoken"])
        self.store.collaboration(
            self.run_id, payload["t_s"], payload["name"], ",".join(mentions), payload["spoken"], "spoken",
        )
        await self._publish(payload["name"], payload["spoken"], mentions)

    async def whisper(self, payload: dict[str, Any]) -> None:
        self.store.collaboration(
            self.run_id,
            payload["t_s"],
            payload["from"],
            payload["to"],
            payload["text"],
            "whisper",
        )
        await self._publish(payload["from"], f"@{payload['to']} {payload['text']}", [payload["to"]])

    async def _publish(self, speaker: str, text: str, mentions: list[str]) -> None:
        agent = self.agents.get(speaker.lower())
        if not agent:
            return
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                response = await client.post(
                    BAND_MESSAGES,
                    headers={"Authorization": f"Bearer {agent['api_key']}"},
                    json={
                        "agent_id": agent["agent_id"],
                        "text": text,
                        "mentions": mentions,
                        "room": f"code-blue-{self.run_id}",
                    },
                )
            if response.status_code >= 400:
                log.info("BAND rejected %s: %s", speaker, response.status_code)
        except httpx.HTTPError as exc:
            log.info("BAND unreachable for %s: %s", speaker, exc)


def _mentions(text: str) -> list[str]:
    names = []
    for name in ("Kim", "Raj", "Okafor", "Reyes"):
        if name.lower() in text.lower():
            names.append(name)
    return names


def _load_agents(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text()) or {}
    agents: dict[str, dict[str, str]] = {}
    for key, value in data.items():
        if isinstance(value, dict) and value.get("agent_id") and value.get("api_key"):
            agents[str(key).lower()] = {"agent_id": str(value["agent_id"]), "api_key": str(value["api_key"])}
    return agents
