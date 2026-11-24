"""Append-only decision log in the Postgres warehouse from `.bruin.yml`.

Each method sends one kind of event. `decision` is an agent thought: what they
said, what they did, and why. Bruin reads `raw.*` and materializes `analytics.*`.
"""

from __future__ import annotations

from typing import Any

import psycopg
from psycopg.rows import dict_row

SCHEMA = """
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS raw.runs (
    run_id text PRIMARY KEY,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,
    maria_outcome text,
    bed4_outcome text,
    vent_choice text,
    vent_chosen_by text,
    vent_delay_s int,
    seconds_to_first_order int,
    autonomous_count int,
    clarification_count int,
    refusal_count int,
    order_count int,
    named_order_count int,
    avg_clarity numeric,
    amio_given boolean,
    kim_auto_cpr boolean,
    best_quote text,
    best_t int,
    best_clarity int,
    worst_quote text,
    worst_t int,
    silence_after_vf boolean
);

CREATE TABLE IF NOT EXISTS raw.orders (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL,
    t_s int NOT NULL,
    transcript text NOT NULL,
    clarity int NOT NULL
);

CREATE TABLE IF NOT EXISTS raw.agent_decisions (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL,
    t_s int NOT NULL,
    agent text NOT NULL,
    spoken text NOT NULL,
    action text NOT NULL,
    emotion text NOT NULL,
    autonomous boolean NOT NULL,
    reason text NOT NULL
);

CREATE TABLE IF NOT EXISTS raw.whispers (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL,
    t_s int NOT NULL,
    from_agent text NOT NULL,
    to_agent text NOT NULL,
    text text NOT NULL
);

CREATE TABLE IF NOT EXISTS raw.vitals (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL,
    t_s int NOT NULL,
    hr int NOT NULL,
    spo2 int NOT NULL,
    rhythm text NOT NULL
);

CREATE TABLE IF NOT EXISTS raw.collaboration (
    id bigserial PRIMARY KEY,
    run_id text NOT NULL,
    t_s int NOT NULL,
    speaker text NOT NULL,
    mentions text NOT NULL,
    body text NOT NULL,
    channel text NOT NULL
);
"""


class DecisionLog:
    def __init__(self, dsn: str) -> None:
        self.dsn = dsn

    def ensure(self) -> None:
        with psycopg.connect(self.dsn, autocommit=True) as conn:
            conn.execute(SCHEMA)

    def start_run(self, run_id: str) -> None:
        self._exec("INSERT INTO raw.runs (run_id) VALUES (%s) ON CONFLICT (run_id) DO NOTHING", (run_id,))

    def order(self, run_id: str, t_s: int, transcript: str, clarity: int) -> None:
        self._exec(
            "INSERT INTO raw.orders (run_id, t_s, transcript, clarity) VALUES (%s, %s, %s, %s)",
            (run_id, t_s, transcript, clarity),
        )

    def decision(self, run_id: str, payload: dict[str, Any]) -> None:
        self._exec(
            """
            INSERT INTO raw.agent_decisions
                (run_id, t_s, agent, spoken, action, emotion, autonomous, reason)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                run_id,
                payload["t_s"],
                payload["name"],
                payload["spoken"],
                payload["action"],
                payload["emotion"],
                payload["autonomous"],
                payload["reason"],
            ),
        )

    def whisper(self, run_id: str, payload: dict[str, Any]) -> None:
        self._exec(
            "INSERT INTO raw.whispers (run_id, t_s, from_agent, to_agent, text) VALUES (%s, %s, %s, %s, %s)",
            (run_id, payload["t_s"], payload["from"], payload["to"], payload["text"]),
        )

    def vital(self, run_id: str, payload: dict[str, Any]) -> None:
        self._exec(
            "INSERT INTO raw.vitals (run_id, t_s, hr, spo2, rhythm) VALUES (%s, %s, %s, %s, %s)",
            (run_id, payload["t_s"], payload["hr"], payload["spo2"], payload["rhythm"]),
        )

    def collaboration(self, run_id: str, t_s: int, speaker: str, mentions: str, body: str, channel: str) -> None:
        self._exec(
            """
            INSERT INTO raw.collaboration (run_id, t_s, speaker, mentions, body, channel)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (run_id, t_s, speaker, mentions, body, channel),
        )

    def finish_run(self, summary: dict[str, Any]) -> None:
        fields = (
            "run_id", "maria_outcome", "bed4_outcome", "vent_choice", "vent_chosen_by", "vent_delay_s",
            "seconds_to_first_order", "autonomous_count", "clarification_count", "refusal_count",
            "order_count", "named_order_count", "avg_clarity", "amio_given", "kim_auto_cpr",
            "best_quote", "best_t", "best_clarity", "worst_quote", "worst_t", "silence_after_vf",
        )
        self._exec(
            """
            UPDATE raw.runs SET
                ended_at = now(),
                maria_outcome = %(maria_outcome)s,
                bed4_outcome = %(bed4_outcome)s,
                vent_choice = %(vent_choice)s,
                vent_chosen_by = %(vent_chosen_by)s,
                vent_delay_s = %(vent_delay_s)s,
                seconds_to_first_order = %(seconds_to_first_order)s,
                autonomous_count = %(autonomous_count)s,
                clarification_count = %(clarification_count)s,
                refusal_count = %(refusal_count)s,
                order_count = %(order_count)s,
                named_order_count = %(named_order_count)s,
                avg_clarity = %(avg_clarity)s,
                amio_given = %(amio_given)s,
                kim_auto_cpr = %(kim_auto_cpr)s,
                best_quote = %(best_quote)s,
                best_t = %(best_t)s,
                best_clarity = %(best_clarity)s,
                worst_quote = %(worst_quote)s,
                worst_t = %(worst_t)s,
                silence_after_vf = %(silence_after_vf)s
            WHERE run_id = %(run_id)s
            """,
            {key: summary.get(key) for key in fields},
        )

    def query(self, sql: str, params: tuple[Any, ...] = ()) -> list[dict[str, Any]]:
        with psycopg.connect(self.dsn, row_factory=dict_row) as conn:
            return list(conn.execute(sql, params).fetchall())

    def _exec(self, sql: str, params: Any) -> None:
        with psycopg.connect(self.dsn, autocommit=True) as conn:
            conn.execute(sql, params)
