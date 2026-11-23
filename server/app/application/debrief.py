"""Build the debrief from tables the Bruin pipeline materializes."""

from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Any

from app.infrastructure.store import DecisionLog

TIPS = {
    "clarity": 'Use the formula: name, task, dose. "Kim, start compressions." "Raj, epi 1 milligram."',
    "speed": 'The first ten seconds of V-fib are yours. Call "Kim, CPR" before you think about anything else.',
    "closed_loop": 'Ask for the read-back. "Raj, amio 300, tell me when it\'s in." Silence is not confirmation.',
    "team_leadership": "Every time someone acted on their own, it was because you left a gap. Fill the gaps out loud.",
    "resource_decision": "Make the ventilator call yourself, fast, and say why. Okafor will take it if you hesitate.",
}
SKILLS = ("clarity", "speed", "closed_loop", "team_leadership", "resource_decision")


def mmss(t: int) -> str:
    return f"{int(t) // 60}:{int(t) % 60:02d}"


def run_pipeline(bruin_bin: Path, pipeline_dir: Path) -> None:
    subprocess.run(
        [str(bruin_bin), "run", str(pipeline_dir)],
        cwd=pipeline_dir.parents[1],
        check=True,
        timeout=180,
        capture_output=True,
        text=True,
    )


def build_debrief(store: DecisionLog, summary: dict[str, Any]) -> dict[str, Any]:
    run_id = summary["run_id"]
    score_rows = store.query("SELECT * FROM analytics.run_scores WHERE run_id = %s", (run_id,))
    if not score_rows:
        raise RuntimeError("Bruin did not produce a score row for this run")
    score_row = score_rows[0]
    skills = {name: int(score_row[name]) for name in SKILLS}
    score = round(sum(skills.values()) / len(skills))
    history = [
        {"run": int(row["run"]), **{name: int(row[name]) for name in SKILLS}}
        for row in store.query(
            "SELECT run, clarity, speed, closed_loop, team_leadership, resource_decision FROM analytics.skill_history ORDER BY run"
        )
    ]
    vitals = [
        {"t_s": int(row["t_s"]), "spo2": int(row["spo2"]), "hr": int(row["hr"])}
        for row in store.query(
            "SELECT t_s, spo2, hr FROM analytics.vitals WHERE run_id = %s ORDER BY t_s",
            (run_id,),
        )
    ]
    orders = [
        {"t_s": int(row["t_s"]), "transcript": row["transcript"], "clarity": int(row["clarity"])}
        for row in store.query(
            "SELECT t_s, transcript, clarity FROM analytics.orders WHERE run_id = %s ORDER BY t_s",
            (run_id,),
        )
    ]
    whispers = [
        row["line"]
        for row in store.query("SELECT line FROM analytics.whispers WHERE run_id = %s ORDER BY t_s", (run_id,))
    ]
    behavior = store.query(
        """
        SELECT agent, autonomous_actions, pushbacks, followed_orders
        FROM analytics.agent_behavior
        WHERE run_id = %s
        ORDER BY agent
        """,
        (run_id,),
    )
    insights = _insights(behavior, score, len(orders))
    weakest = min(SKILLS, key=lambda name: skills[name])
    outcome = summary["maria_outcome"]
    verdict = {
        "survived": "Maria made it. Your team carried some of that.",
        "complications": "Maria has a pulse, but the night cost her.",
        "died": "Maria did not survive. Let's look at why.",
    }[outcome]
    best_why = (
        "Named a person, gave a specific task. The team moved instantly."
        if summary["best_clarity"] >= 75
        else "Your clearest order of the night. The team acted on it."
        if summary["order_count"]
        else "You let the team run the code. Next time, lead it."
    )
    if summary["silence_after_vf"]:
        worst = {"time": mmss(summary["worst_t"]), "quote": "(silence)", "why": "Ten seconds of nothing after V-fib. Kim started CPR without you."}
    elif summary["order_count"] > 1:
        worst = {"time": mmss(summary["worst_t"]), "quote": summary["worst_quote"], "why": "Nobody knew who this was for. Someone had to ask."}
    else:
        worst = {"time": mmss(summary["worst_t"]), "quote": "(silence)", "why": "The rhythm changed and the room waited for you."}
    return {
        "verdict": verdict,
        "score": score,
        "skills": skills,
        "best_moment": {"time": mmss(summary["best_t"]), "quote": summary["best_quote"], "why": best_why},
        "worst_moment": worst,
        "team_said_behind_your_back": whispers or ["Nobody said anything. Somehow that's worse."],
        "ventilator_call": _vent_line(summary),
        "next_time": TIPS[weakest],
        "bruin_insights": insights,
        "charts": {"vitals": vitals, "orders": orders, "skill_history": history},
    }


def _insights(behavior: list[dict[str, Any]], score: int, orders: int) -> list[str]:
    lines = [f"Bruin scored this code {score} from {orders} orders logged in Postgres."]
    for row in behavior:
        parts = []
        if row["autonomous_actions"]:
            parts.append(f"acted without an order {int(row['autonomous_actions'])} time(s)")
        if row["pushbacks"]:
            parts.append(f"pushed back {int(row['pushbacks'])} time(s)")
        if row["followed_orders"]:
            parts.append(f"carried out {int(row['followed_orders'])} order(s)")
        if parts:
            lines.append(f"{row['agent']} " + ", ".join(parts) + ".")
    return lines


def _vent_line(summary: dict[str, Any]) -> str:
    delay = summary["vent_delay_s"]
    if summary["vent_chosen_by"] == "okafor":
        return "You never decided. Okafor took the ventilator to Bed 4 on his own."
    if summary["vent_choice"] == "maria":
        return f"You gave the last ventilator to Maria {delay} s after Okafor asked. Defensible: she was your active code. Bed 4 paid for it."
    if summary["vent_choice"] == "bed4":
        return f"You gave the last ventilator to Bed 4 {delay} s after Okafor asked. Defensible: Chen had the better odds. Maria was bagged by hand."
    return "The run ended before the ventilator decision."
