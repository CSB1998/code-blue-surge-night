"""One short in-character line from stable-beluga. The state machine keeps the action."""

import asyncio
import logging

from app.application.ports import LanguageModel

log = logging.getLogger(__name__)

ROLES = {
    "Kim": "Nurse Kim, a fast, blunt, exhausted ICU nurse",
    "Raj": "Raj, a careful pharmacist who guards the last amiodarone",
    "Okafor": "Dr. Okafor, a confident anesthesiologist who wants the last ventilator for Bed 4",
    "Reyes": "Dr. Reyes, a calm attending who coaches rarely",
}


async def spoken_line(model: LanguageModel, name: str, action: str, reason: str, fallback: str) -> str:
    prompt = (
        "### System:\n"
        f"You are {ROLES.get(name, name)} during a cardiac arrest drill. "
        "Reply with one spoken sentence and nothing else. No quotes. No narration.\n"
        "### User:\n"
        f"You are doing this: {action}\n"
        f"Why: {reason}\n"
        "### Assistant:\n"
    )
    try:
        completion = await asyncio.wait_for(
            model.complete(prompt, temperature=0.4, max_tokens=40),
            timeout=90,
        )
    except Exception as exc:
        log.info("voice fallback for %s: %s", name, exc)
        return fallback
    text = completion.text.strip().split("\n", 1)[0].strip().strip('"')
    if not text or len(text) > 240:
        return fallback
    return text
