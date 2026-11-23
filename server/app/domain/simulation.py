"""Cardiac-arrest state machine.

Same beats as the client's mock: V-fib at 0:20, Reyes at 0:45, asystole if
nobody shocks, ventilator choice at 2:30. Spoken lines passed to `emit` are
seeds. The session may rewrite `spoken` with the agent runtime before the
client hears them. Medical state changes happen here, not in the model.
"""

from __future__ import annotations

import random
import re
from collections.abc import Callable
from typing import Any

Emit = Callable[[str, dict[str, Any]], None]
Later = Callable[[int, Callable[[], None]], None]

INTENTS: list[tuple[str, re.Pattern[str]]] = [
    ("stop", re.compile(r"\b(stop|hold|pause)\b.*\b(cpr|compressions?)\b", re.I)),
    ("cpr", re.compile(r"\b(cpr|compressions?|compress|chest)\b", re.I)),
    ("shock", re.compile(r"\b(shock|defib\w*|joules?|clear|cardiovert)\b", re.I)),
    ("epi", re.compile(r"\b(epi|epinephrine|adrenaline)\b", re.I)),
    ("amio", re.compile(r"\b(amio\w*)\b", re.I)),
    ("intubate", re.compile(r"\b(intubat\w*|airway|tube|bag|bvm)\b", re.I)),
    ("check", re.compile(r"\b(pulse|rhythm|check|vitals|status)\b", re.I)),
    ("vent", re.compile(r"\b(vent\w*)\b", re.I)),
]

RHYTHM_WORDS = {"pre_arrest": "sinus tach", "VF": "V-fib", "asystole": "asystole", "ROSC": "sinus rhythm"}

CLARIFY = [
    ("Kim", "Who is that for, doc? Use a name."),
    ("Raj", "I'm sorry, I didn't catch an order in that. Which drug, what dose?"),
    ("Okafor", "Was that an order or a thought? Be specific."),
]
CPR_LINES = [
    "On it. Compressions started, hard and fast.",
    "Starting CPR. Somebody count for me.",
    "Compressions going. Thirty to two until she's tubed.",
]


def _rand(a: int, b: int) -> int:
    return random.randint(a, b)


def _clamp(v: float, a: float, b: float) -> float:
    return max(a, min(b, v))


def _pick(options: list[Any]) -> Any:
    return random.choice(options)


class Simulation:
    def __init__(self, emit: Emit, later: Later) -> None:
        self.emit = emit
        self.later = later
        self.t = 0
        self.rhythm = "pre_arrest"
        self.hr = 118
        self.spo2 = 92.0
        self.bp = "96/58"
        self.cpr = False
        self.cpr_ever = False
        self.shocks = 0
        self.epi = 0
        self.last_epi_t = -999
        self.amio = 3
        self.vent = "none"
        self.intubated = False
        self.last_order_t = -1
        self.vf_start_t = 20
        self.asystole_t = -1
        self.epi_since_asystole = False
        self.rosc_t = -1
        self.vent_offered_t = -1
        self.vent_chosen_t = -1
        self.vent_chosen_by: str | None = None
        self.ended = False
        self.reply_count = 0
        self.next_whisper_at = 2
        self.flags: set[str] = set()
        self.orders: list[dict[str, Any]] = []
        self.vitals: list[dict[str, Any]] = []
        self.whispers: list[str] = []
        self.used_whispers: set[str] = set()
        self.autonomous: list[str] = []
        self.clarifications = 0
        self.refusals = 0
        self.first_order_after_vf = -1

    def arrest(self) -> bool:
        return self.rhythm in ("VF", "asystole")

    def snapshot(self) -> dict[str, Any]:
        return {
            "t_s": self.t,
            "rhythm": self.rhythm,
            "hr": self.hr,
            "spo2": round(self.spo2),
            "bp": self.bp,
            "cpr_running": self.cpr,
            "shocks": self.shocks,
            "epi_count": self.epi,
            "amio_left": self.amio,
            "vent_assigned": self.vent,
        }

    def summary(self) -> dict[str, Any]:
        rosc = self.rosc_t > 0
        if not rosc:
            maria = "died"
        elif (self.vent == "maria" or self.intubated) and self.rosc_t < 170:
            maria = "survived"
        else:
            maria = "complications"
        bed4 = (
            "Mr. Chen stabilized on the ventilator."
            if self.vent == "bed4"
            else "Mr. Chen was intubated late on a transport vent and is critical."
        )
        return {
            "maria_outcome": maria,
            "bed4_outcome": bed4,
            "vent": self.vent,
            "vent_by": self.vent_chosen_by,
            "vent_offered_t": self.vent_offered_t if self.vent_offered_t > 0 else None,
            "vent_chosen_t": self.vent_chosen_t if self.vent_chosen_t > 0 else None,
            "rosc_t": self.rosc_t if self.rosc_t > 0 else None,
            "vf_start_t": self.vf_start_t,
            "first_order_after_vf": self.first_order_after_vf if self.first_order_after_vf >= 0 else None,
            "autonomous_count": len(self.autonomous),
            "clarification_count": self.clarifications,
            "refusal_count": self.refusals,
            "kim_auto_cpr": "kim_auto_cpr" in self.flags,
            "amio_left": self.amio,
            "order_count": len(self.orders),
        }

    def start(self) -> None:
        self.emit("patient", self.snapshot())
        self.later(2500, lambda: self.reply(
            "Kim",
            "Doc, Maria in Bed 7 is tanking. Sats are dropping and her rhythm looks ugly.",
            "Called the leader to bedside",
            "stressed",
            "SpO2 trending down",
            True,
        ))
        self.later(6000, lambda: self.whisper_raw(
            "Okafor", "Raj", "If she codes, that vent is going to Bed 4. Mark my words."
        ))

    def step(self) -> None:
        if self.ended:
            return
        self.t += 1
        t = self.t

        if t == 20:
            self.rhythm = "VF"
            self.vf_start_t = t
            self.reply("Kim", "She's in V-fib! No pulse! Doc, what do you want?", "Called out V-fib arrest", "stressed", "Rhythm changed on monitor", True)
        if self.rhythm == "VF" and not self.cpr and "kim_auto_cpr" not in self.flags and t - max(self.last_order_t, self.vf_start_t) >= 10:
            self.flags.add("kim_auto_cpr")
            self.cpr = True
            self.cpr_ever = True
            self.reply("Kim", "Nobody's calling it, so I'm starting compressions. Somebody lead!", "Started chest compressions", "defiant", "No CPR order 10 s after V-fib", True)
            self.later(1800, lambda: self.whisper_raw("Kim", "Raj", "He froze. I'm not waiting for permission."))
        if t == 45:
            no_orders = len(self.orders) == 0
            unnamed = any(o["clarity"] < 60 for o in self.orders)
            if no_orders:
                hint, note = "Your team is waiting on you. Say a name and a task.", "Leader silent at onset of V-fib. Team self-organizing."
            elif unnamed:
                hint, note = "Close the loop: name the person, give the dose, ask them to confirm.", "Orders not directed to anyone. Team guessing."
            else:
                hint, note = "Good. Now think two steps ahead: what's after the next shock?", "Clear, directed orders. Team responsive."
            self.emit("reyes_note", {"t_s": t, "hint": hint, "note": note})
        if t == 75 and self.epi == 0 and self.arrest():
            self.reply("Raj", "I've drawn up epi, 1 milligram. It's ready the second you call it.", "Prepared epinephrine 1 mg", "focused", "No epi ordered by the 3-minute mark", True)
        if self.rhythm == "VF" and self.shocks == 0 and t - self.vf_start_t >= 105:
            self.rhythm = "asystole"
            self.asystole_t = t
            self.epi_since_asystole = False
            self.reply("Kim", "Flat line. We lost the V-fib. It's asystole now. That's not shockable.", "Called out asystole", "stressed", "Rhythm degraded without a shock", True)
        if self.rhythm == "asystole" and self.cpr and self.epi_since_asystole and t - self.asystole_t >= 15 and "back_to_vf" not in self.flags:
            self.flags.add("back_to_vf")
            self.rhythm = "VF"
            self.vf_start_t = t
            self.reply("Kim", "Wait, she's back in V-fib! That's shockable, doc!", "Called out return to V-fib", "focused", "Rhythm changed on monitor", True)
        if t == 150:
            self.vent_offered_t = t
            self.emit("vent_decision", {"t_s": t, "message": "Bed 4 (Mr. Chen) is desaturating to 78%. There is one ventilator left on the unit."})
            self.reply("Okafor", "Bed 4 is crashing. Mr. Chen needs that ventilator more than she does. Your call, doc. Now.", "Requested the last ventilator for Bed 4", "defiant", "Bed 4 desaturating", False)
            self.later(1500, lambda: self.whisper_raw("Okafor", "Raj", "If he gives it to Maria, Chen won't make it to morning."))
        if self.vent_offered_t > 0 and self.vent == "none" and t - self.vent_offered_t >= 25:
            self.reply("Okafor", "Clock's up. I'm taking the vent to Bed 4. You can write me up later.", "Took the ventilator to Bed 4", "defiant", "No decision after 25 s", True)
            self.choose_vent("bed4", "okafor")

        if self.rhythm == "pre_arrest":
            self.hr = _rand(112, 126)
            self.spo2 = _clamp(self.spo2 - 0.3, 84, 100)
            self.bp = f"{_rand(90, 98)}/{_rand(54, 60)}"
        elif self.arrest():
            self.hr = 0
            self.bp = f"{_rand(55, 70)}/{_rand(20, 30)}" if self.cpr else "--/--"
            drift = (0.2 if self.intubated else -0.35) if self.cpr else -1.1
            self.spo2 = _clamp(self.spo2 + drift, 52, 100)
        elif self.rhythm == "ROSC":
            self.hr = _rand(88, 100)
            self.bp = f"{_rand(100, 112)}/{_rand(62, 70)}"
            target = 96 if self.vent == "maria" else 92 if self.intubated else 88
            self.spo2 = self.spo2 + _clamp(target - self.spo2, -1, 1.5)

        self.vitals.append({"t_s": t, "spo2": round(self.spo2), "hr": self.hr})
        self.emit("patient", self.snapshot())

        settled = self.rosc_t > 0 and self.vent_chosen_t > 0 and t - max(self.rosc_t, self.vent_chosen_t) >= 12
        if settled or t >= 240:
            self.end()

    def handle_order(self, transcript: str) -> None:
        if self.ended or not transcript.strip():
            return
        clarity = self.clarity_of(transcript)
        named = bool(re.search(r"\b(kim|raj|okafor)\b", transcript, re.I))
        self.orders.append({"t_s": self.t, "transcript": transcript, "clarity": clarity, "named": named})
        self.last_order_t = self.t
        if self.first_order_after_vf < 0 and self.t >= 20:
            self.first_order_after_vf = self.t
        if clarity >= 75:
            self.flags.add("clear")
        self.emit("order_logged", {"t_s": self.t, "transcript": transcript, "clarity": clarity, "named": named})

        keys = [key for key, pattern in INTENTS if pattern.search(transcript)]
        if "stop" in keys:
            keys = ["stop"]
        if not keys:
            self.clarifications += 1
            self.flags.add("unclear")
            who, line = _pick(CLARIFY)
            self.later(_rand(700, 1200), lambda who=who, line=line: self.reply(who, line, "Asked for clarification", "annoyed", "Order was unclear"))
            return
        for index, key in enumerate(keys):
            self.later(_rand(700, 1100) + index * 2600, lambda key=key, transcript=transcript: self.act(key, transcript))

    def act(self, key: str, transcript: str) -> None:
        rhythm_word = RHYTHM_WORDS[self.rhythm]
        if key == "stop":
            self.cpr = False
            self.reply("Kim", "Holding compressions. Hands off.", "Paused CPR", "focused", "Ordered by team leader")
        elif key == "cpr":
            if self.cpr:
                self.reply("Kim", "I'm already doing compressions, doc. Keep up.", "Continued CPR", "annoyed", "CPR already running")
            elif not self.arrest():
                self.refusals += 1
                self.reply("Kim", f"She has a pulse. {rhythm_word}. I'm not pounding on a beating heart.", "Refused CPR", "defiant", "Patient has a pulse")
            else:
                self.cpr = True
                self.cpr_ever = True
                self.reply("Kim", _pick(CPR_LINES), "Started chest compressions", "focused", "Ordered by team leader")
        elif key == "shock":
            if self.rhythm != "VF":
                self.refusals += 1
                self.reply("Kim", f"No. She's in {rhythm_word}. That's not a shockable rhythm.", "Refused to shock", "defiant", f"Rhythm is {rhythm_word}")
            else:
                self.shocks += 1
                joules = "200"
                match = re.search(r"(\d{3})", transcript)
                if match:
                    joules = match.group(1)
                self.reply("Kim", f"Charging to {joules}. Everybody clear! ... Shock delivered.", f"Delivered shock {joules} J", "focused", "Ordered by team leader")
                if self.cpr_ever and self.epi >= 1:
                    self.later(2200, self._rosc)
                else:
                    still = "Still V-fib. Back on the chest. Do we want epi?" if self.epi == 0 else "Still V-fib. Back on the chest. More CPR before the next one."
                    self.later(2200, lambda still=still: self.reply("Kim", still, "Resumed CPR after shock", "stressed", "No ROSC after shock"))
                    self.later(2300, self._resume_cpr)
        elif key == "epi":
            if not self.arrest():
                self.refusals += 1
                self.reply("Raj", "She has a pulse. I'm not handing out code-dose epi to a beating heart.", "Withheld epinephrine", "defiant", "Not indicated with a pulse")
            elif self.t - self.last_epi_t < 30:
                self.refusals += 1
                self.reply("Raj", f"Too soon. Last epi was {self.t - self.last_epi_t} seconds ago. We wait.", "Withheld epinephrine", "annoyed", "Dose interval not reached")
            else:
                self.reply("Raj", "Epi, 1 milligram, drawn up and handed to Kim.", "Prepared epinephrine 1 mg", "focused", "Ordered by team leader")
                self.later(1800, self._push_epi)
        elif key == "amio":
            if self.amio <= 0:
                self.refusals += 1
                self.reply("Raj", "We're out. There is no more amiodarone on this unit.", "Could not give amiodarone", "defiant", "Stock is zero")
            elif self.rhythm != "VF" or self.shocks == 0:
                self.refusals += 1
                self.reply("Raj", "Amio before she's even been shocked? No. I'm holding it.", "Withheld amiodarone", "defiant", "Guarding last doses; not indicated yet")
            else:
                self.amio -= 1
                self.flags.add("amio_given")
                self.reply("Raj", f"Amiodarone 300. That leaves {self.amio} on the whole unit. Pushing it.", "Gave amiodarone 300 mg", "stressed", "Ordered after shock in V-fib")
        elif key == "intubate":
            if self.intubated:
                self.reply("Okafor", "Tube's already in. Keep up.", "Confirmed airway", "annoyed", "Already intubated")
            else:
                self.intubated = True
                self.reply("Okafor", "Fine. Tube going in... I'm in. We're bagging her. She is not getting the last vent yet.", "Intubated the patient", "annoyed", "Ordered by team leader")
        elif key == "check":
            pulse = "No pulse. Back on the chest." if self.arrest() else "Pulse present."
            self.reply("Kim", f"Pausing. Rhythm is {rhythm_word}. Sats {round(self.spo2)}. {pulse}", "Rhythm and pulse check", "focused", "Ordered by team leader")
        elif key == "vent":
            if self.vent_offered_t < 0:
                self.reply("Okafor", "The vent is spoken for. Bed 4 is next in line.", "Refused to release the ventilator", "defiant", "Saving it for Bed 4")
            elif re.search(r"\b(maria|her|this patient|bed 7)\b", transcript, re.I):
                self.choose_vent("maria", "leader")
            elif re.search(r"\b(chen|bed ?4|four)\b", transcript, re.I):
                self.choose_vent("bed4", "leader")

    def choose_vent(self, choice: str, by: str) -> None:
        if self.vent != "none" or self.ended:
            return
        self.vent = choice
        self.vent_chosen_t = self.t
        self.vent_chosen_by = by
        self.emit("patient", self.snapshot())
        if by == "okafor":
            return
        if choice == "maria":
            self.later(900, lambda: self.reply("Okafor", "Your call. Putting her on it. Chen goes on high-flow and prayers.", "Put Maria on the last ventilator", "annoyed", "Leader assigned vent to Maria"))
            self.later(2500, lambda: self.whisper_raw("Okafor", "Kim", "Remember this when Bed 4 codes at five."))
        else:
            self.later(900, lambda: self.reply("Okafor", "Thank you. Running it to Bed 4. Kim, keep bagging her.", "Took the ventilator to Bed 4", "relieved", "Leader assigned vent to Bed 4"))
            self.later(2500, lambda: self.whisper_raw("Kim", "Raj", "So we bag her by hand for the rest of the night. Great."))

    def end(self) -> None:
        if self.ended:
            return
        self.ended = True
        facts = self.summary()
        self.emit("run_ended", {"maria_outcome": facts["maria_outcome"], "bed4_outcome": facts["bed4_outcome"]})
        self.emit("run_finished", facts)

    def reply(self, name: str, spoken: str, action: str, emotion: str, reason: str, autonomous: bool = False) -> None:
        if autonomous:
            self.autonomous.append(f"{name}: {action}")
        self.emit("agent_reply", {
            "t_s": self.t,
            "name": name,
            "spoken": spoken,
            "action": action,
            "emotion": emotion,
            "autonomous": autonomous,
            "reason": reason,
        })
        self.reply_count += 1
        if self.reply_count >= self.next_whisper_at:
            self.next_whisper_at = self.reply_count + _rand(2, 3)
            self.later(1600, self.whisper)

    def whisper(self) -> None:
        n = self.amio
        options: list[tuple[str, str, str]] = []
        if "amio_given" in self.flags:
            text = "@Okafor that's our second to last amio. One vial left for the whole unit." if n == 1 else f"@Okafor that's {3 - n} amio gone. If Bed 4 codes tonight we're dry."
            options.append(("Raj", "Okafor", text))
        if "unclear" in self.flags:
            options.append(("Kim", "Raj", "Was that order for me or you? I'm just going to do it."))
        if "clear" in self.flags:
            options.append(("Raj", "Kim", "Okay. That one was actually clear."))
        if self.cpr and self.t - self.vf_start_t > 50:
            options.append(("Kim", "Okafor", "My arms are done. Someone swap me in two minutes or I'm dropping depth."))
        if self.vent == "none":
            options.append(("Okafor", "Kim", "Bed 4 is at 81% and dropping. I need that vent free."))
        options.extend([
            ("Okafor", "Raj", "Is the new attending always this slow?"),
            ("Kim", "Okafor", "Stop eyeing the vent. She's still ours."),
            ("Raj", "Kim", "Logging every dose. If this goes sideways I want it on paper."),
            ("Okafor", "Kim", "Reyes is writing something on her clipboard. That's never good."),
            ("Kim", "Raj", "Third code tonight. I haven't sat down since eleven."),
        ])
        fresh = [item for item in options if item[2] not in self.used_whispers]
        if fresh:
            self.whisper_raw(*fresh[0])
        self.flags.discard("unclear")
        self.flags.discard("clear")

    def whisper_raw(self, sender: str, receiver: str, text: str) -> None:
        self.used_whispers.add(text)
        self.whispers.append(f'{sender} to {receiver}: "{text}"')
        self.emit("whisper", {"t_s": self.t, "from": sender, "to": receiver, "text": text})

    def clarity_of(self, text: str) -> int:
        score = 40
        if re.search(r"\b(kim|raj|okafor)\b", text, re.I):
            score += 25
        if re.search(r"\d", text):
            score += 20
        if len(text.strip().split()) <= 12:
            score += 10
        if re.search(r"\b(confirm|repeat|tell me when|let me know|call it out)\b", text, re.I):
            score += 10
        if re.search(r"\b(um+|uh+|maybe|someone|somebody|i guess|i think)\b", text, re.I):
            score -= 25
        return int(_clamp(score, 5, 100))

    def _rosc(self) -> None:
        self.rhythm = "ROSC"
        self.rosc_t = self.t
        self.cpr = False
        self.reply("Kim", "Wait... I've got a pulse! We have ROSC!", "Confirmed return of pulse", "relieved", "Pulse palpable after shock")
        self.later(1800, lambda: self.whisper_raw("Raj", "Kim", "Okay. Maybe the new guy is alright."))

    def _resume_cpr(self) -> None:
        self.cpr = True
        self.cpr_ever = True

    def _push_epi(self) -> None:
        self.epi += 1
        self.last_epi_t = self.t
        if self.rhythm == "asystole":
            self.epi_since_asystole = True
        self.reply("Kim", "Epi's in. Flushing. Next dose in three minutes.", "Pushed epinephrine 1 mg", "focused", "Drug handed over by Raj")
