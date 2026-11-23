"""The shared BAND room, AWSHackathon.

Kim, Raj, Okafor, and Reyes are already in that chat. A LangGraph turn posts
each spoken line or whisper, then lets the teammate who was named answer.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import Any

import httpx
import yaml

from app.application.collab import build_collab_graph
from app.application.ports import LanguageModel
from app.application.voice import spoken_line
from app.infrastructure.store import DecisionLog

log = logging.getLogger(__name__)

BASE = "https://api.band.ai/api/v1/agent"
ROOM_TITLE = "AWSHackathon"
NAMES = {"kim": "Kim", "raj": "Raj", "okafor": "Okafor", "reyes": "Reyes"}
OnReply = Callable[[dict[str, Any]], Awaitable[None]]


class BandRoom:
    def __init__(self, run_id: str, store: DecisionLog, config_path: Path, model: LanguageModel) -> None:
        self.run_id = run_id
        self.store = store
        self.model = model
        self.agents = _load_agents(config_path)
        self.room_id: str | None = None
        self.on_reply: OnReply | None = None
        self._lock = asyncio.Lock()
        self._model_lock = asyncio.Lock()
        self._graph = build_collab_graph(self._complete, self._post)

    async def spoken(self, payload: dict[str, Any]) -> None:
        named = _mentions(payload["spoken"], payload["name"])
        self.store.collaboration(
            self.run_id, payload["t_s"], payload["name"], ",".join(named), payload["spoken"], "spoken",
        )
        await self._turn(
            speaker=payload["name"],
            text=payload["spoken"],
            post_to=named,
            reply_to=named[0] if named else "",
            action=payload.get("action", ""),
            reason=payload.get("reason", ""),
            t_s=payload["t_s"],
        )

    async def whisper(self, payload: dict[str, Any]) -> None:
        self.store.collaboration(
            self.run_id, payload["t_s"], payload["from"], payload["to"], payload["text"], "whisper",
        )
        await self._turn(
            speaker=payload["from"],
            text=payload["text"],
            post_to=[payload["to"]],
            reply_to=payload["to"],
            action="Answer a whisper",
            reason=f"{payload['from']} whispered to {payload['to']}",
            t_s=payload["t_s"],
        )

    async def _turn(self, **state: Any) -> None:
        try:
            await self._ensure()
            if not self.room_id:
                return
            result = await self._graph.ainvoke(state)
        except Exception:
            log.exception("BAND turn failed for %s", state.get("speaker"))
            return
        reply = result.get("reply")
        if reply and self.on_reply:
            await self.on_reply({
                "t_s": state["t_s"],
                "name": result["reply_from"],
                "spoken": reply,
                "action": "Answered in the BAND room",
                "emotion": "focused",
                "autonomous": True,
                "reason": f"Replying to {state['speaker']} in {ROOM_TITLE}",
            })

    async def _complete(self, name: str, action: str, reason: str) -> str:
        async with self._model_lock:
            return await spoken_line(self.model, name, action, reason, "")

    async def _post(self, speaker: str, text: str, mentions: list[str]) -> None:
        author = self.agents.get(speaker.lower())
        if not author or not self.room_id or not text:
            return
        targets = self._targets(speaker, mentions)
        content, mention_body = _address(text, targets)
        if not mention_body:
            return
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                f"{BASE}/chats/{self.room_id}/messages",
                headers=_headers(author["api_key"]),
                json={"message": {"content": content, "mentions": mention_body}},
            )
        if response.status_code >= 400:
            log.info("BAND rejected %s: %s %s", speaker, response.status_code, response.text[:180])

    async def _ensure(self) -> None:
        if self.room_id or not self.agents:
            return
        async with self._lock:
            if self.room_id or not self.agents:
                return
            async with httpx.AsyncClient(timeout=15) as client:
                for agent in self.agents.values():
                    profile = await client.get(f"{BASE}/me", headers=_headers(agent["api_key"]))
                    profile.raise_for_status()
                    data = profile.json()["data"]
                    agent["handle"] = data["handle"]
                    agent["display"] = data.get("name") or agent["name"]
                finder = self.agents.get("kim") or next(iter(self.agents.values()))
                listed = await client.get(
                    f"{BASE}/chats",
                    headers=_headers(finder["api_key"]),
                    params={"page_size": 50},
                )
                listed.raise_for_status()
                for row in listed.json().get("data") or []:
                    if str(row.get("title", "")).strip().lower() == ROOM_TITLE.lower():
                        self.room_id = row["id"]
                        break
            if not self.room_id:
                log.info("BAND room %s was not found for these agents", ROOM_TITLE)

    def _targets(self, speaker: str, mentions: list[str]) -> list[dict[str, str]]:
        wanted = {name.lower() for name in mentions}
        wanted.discard(speaker.lower())
        if not wanted:
            wanted.add("reyes" if speaker.lower() != "reyes" else "kim")
        return [agent for key, agent in self.agents.items() if key in wanted and agent.get("handle")]


def _address(text: str, targets: list[dict[str, str]]) -> tuple[str, list[dict[str, str]]]:
    content = text
    body = []
    for agent in targets:
        handle = agent["handle"]
        if f"@{handle}" not in content:
            content = f"@{handle} {content}"
        body.append({"id": agent["agent_id"], "handle": handle, "name": agent["display"]})
    return content, body


def _headers(api_key: str) -> dict[str, str]:
    return {"X-API-Key": api_key, "Accept": "application/json", "Content-Type": "application/json"}


def _mentions(text: str, speaker: str) -> list[str]:
    return [
        name
        for name in ("Kim", "Raj", "Okafor", "Reyes")
        if name.lower() in text.lower() and name.lower() != speaker.lower()
    ]


def _load_agents(path: Path) -> dict[str, dict[str, str]]:
    if not path.exists():
        return {}
    data = yaml.safe_load(path.read_text()) or {}
    agents: dict[str, dict[str, str]] = {}
    for key, value in data.items():
        if isinstance(value, dict) and value.get("agent_id") and value.get("api_key"):
            name = str(key).lower()
            agents[name] = {
                "agent_id": str(value["agent_id"]),
                "api_key": str(value["api_key"]),
                "name": NAMES.get(name, name),
            }
    return agents
