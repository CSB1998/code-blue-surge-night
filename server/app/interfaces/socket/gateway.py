"""Socket.io gateway. One code run per connection."""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

import socketio

from app.application.debrief import build_debrief, run_pipeline
from app.application.ports import LanguageModel
from app.application.voice import spoken_line
from app.domain.code_run import CodeRun
from app.infrastructure.band_room import BandRoom
from app.infrastructure.config import Settings
from app.infrastructure.store import DecisionLog

log = logging.getLogger(__name__)


def attach(sio: socketio.AsyncServer, settings: Settings, store: DecisionLog, model: LanguageModel) -> None:
    sessions: dict[str, GameSession] = {}

    @sio.event
    async def connect(sid, environ, auth=None):
        log.info("client connected %s", sid)

    @sio.event
    async def disconnect(sid):
        session = sessions.pop(sid, None)
        if session:
            session.stop()

    @sio.on("start_run")
    async def start_run(sid, _data):
        previous = sessions.pop(sid, None)
        if previous:
            previous.stop()
        session = GameSession(sid, sio, settings, store, model)
        sessions[sid] = session
        session.start()

    @sio.on("order")
    async def order(sid, data):
        session = sessions.get(sid)
        if session and isinstance(data, dict):
            session.order(str(data.get("transcript", "")))

    @sio.on("vent_choice")
    async def vent_choice(sid, data):
        session = sessions.get(sid)
        if session and isinstance(data, dict):
            session.run.choose_vent(str(data.get("choice", "maria")), "leader")

    @sio.on("end_run")
    async def end_run(sid, _data):
        session = sessions.get(sid)
        if session:
            session.run.end()


class GameSession:
    def __init__(self, sid: str, sio: socketio.AsyncServer, settings: Settings, store: DecisionLog, model: LanguageModel) -> None:
        self.sid = sid
        self.sio = sio
        self.settings = settings
        self.store = store
        self.model = model
        self.run_id = uuid.uuid4().hex[:12]
        self.tasks: list[asyncio.Task[None]] = []
        self.voice_lock = asyncio.Lock()
        self.model_task: asyncio.Task[None] | None = None
        self.band = BandRoom(self.run_id, store, settings.band_config)
        self.run = CodeRun(self.run_id, self.emit_now, self.later)
        self._debrief_started = False

    def start(self) -> None:
        self.store.start_run(self.run_id)
        self.run.start()
        self.tasks.append(asyncio.create_task(self._ticks()))

    def stop(self) -> None:
        self.run.ended = True
        for task in self.tasks:
            task.cancel()

    def order(self, transcript: str) -> None:
        before = len(self.run.orders)
        self.run.handle_order(transcript)
        if len(self.run.orders) > before:
            placed = self.run.orders[-1]
            self.store.order(self.run_id, placed["t_s"], placed["transcript"], placed["clarity"])

    def emit_now(self, event: str, payload: dict[str, Any]) -> None:
        asyncio.get_running_loop().create_task(self.deliver(event, dict(payload)))

    def later(self, ms: int, fn) -> None:
        async def wrapper() -> None:
            await asyncio.sleep(ms / 1000)
            if not self.run.ended:
                fn()

        self.tasks.append(asyncio.create_task(wrapper()))

    async def _ticks(self) -> None:
        while not self.run.ended:
            await asyncio.sleep(1)
            if not self.run.ended:
                self.run.step()

    async def deliver(self, event: str, payload: dict[str, Any]) -> None:
        try:
            if event == "agent_reply":
                self.store.decision(self.run_id, payload)
                await self.band.spoken(payload)
                self._schedule_model_line(payload)
            elif event == "whisper":
                self.store.whisper(self.run_id, payload)
                await self.band.whisper(payload)
            elif event == "patient":
                self.store.vital(self.run_id, payload)
            elif event == "run_ended":
                await self.sio.emit(event, payload, to=self.sid)
                await self._finish(payload)
                return
            await self.sio.emit(event, payload, to=self.sid)
        except Exception:
            log.exception("failed to deliver %s", event)

    async def _finish(self, ended: dict[str, Any]) -> None:
        if self._debrief_started:
            return
        self._debrief_started = True
        self.run.ended = True
        summary = self.run.summary()
        summary["maria_outcome"] = ended["maria_outcome"]
        summary["bed4_outcome"] = ended["bed4_outcome"]
        try:
            self.store.finish_run(summary)
            await asyncio.to_thread(run_pipeline, self.settings.bruin_bin, self.settings.pipeline_dir)
            debrief = await asyncio.to_thread(build_debrief, self.store, summary)
        except Exception:
            log.exception("bruin debrief failed")
            debrief = _fallback(summary)
        await self.sio.emit("debrief", debrief, to=self.sid)

    def _schedule_model_line(self, payload: dict[str, Any]) -> None:
        if self.model_task and not self.model_task.done():
            return

        async def speak() -> None:
            line = await spoken_line(
                self.model, payload["name"], payload["action"], payload["reason"], payload["spoken"],
            )
            if line == payload["spoken"] or self._debrief_started:
                return
            extra = {**payload, "spoken": line, "reason": "In their own words"}
            self.store.decision(self.run_id, extra)
            await self.band.spoken(extra)
            await self.sio.emit("agent_reply", extra, to=self.sid)

        self.model_task = asyncio.create_task(speak())


def _fallback(summary: dict[str, Any]) -> dict[str, Any]:
    clarity = int(round(summary["avg_clarity"]))
    skills = {
        "clarity": clarity,
        "speed": 40,
        "closed_loop": 40,
        "team_leadership": 40,
        "resource_decision": 40,
    }
    return {
        "verdict": "The code is over. The Bruin pipeline did not finish, so this score is only a sketch.",
        "score": clarity,
        "skills": skills,
        "best_moment": {"time": "0:00", "quote": summary["best_quote"], "why": "Taken from the order log."},
        "worst_moment": {"time": "0:00", "quote": summary["worst_quote"], "why": "Taken from the order log."},
        "team_said_behind_your_back": summary["whispers"] or ["Nobody said anything. Somehow that's worse."],
        "ventilator_call": "The run ended.",
        "next_time": "Check that Postgres is up and `bruin run bruin/codeblue` succeeds.",
        "bruin_insights": ["The Bruin pipeline failed, so these charts are not from the warehouse."],
        "charts": {
            "vitals": [],
            "orders": [
                {"t_s": order["t_s"], "transcript": order["transcript"], "clarity": order["clarity"]}
                for order in []
            ],
            "skill_history": [{"run": 1, **skills}],
        },
    }
