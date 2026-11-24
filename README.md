# Code Blue: Surge Night

A Track 3 **"Grow with Agents"** training simulation.

It's 2:47 AM in the ICU at City General during a respiratory virus surge. Every bed is full, there is **one ventilator left**, and the heart drug **amiodarone is running low**. You are the doctor leading a cardiac arrest ("code"). You give orders **out loud or by typing**. Four AI teammates respond, act on screen, push back, and message each other. An attending watches from the doorway and debriefs you at the end.

> Training game only. Simplified medicine. Not medical advice.

**How to play a code, line by line:** [RUNBOOK.md](RUNBOOK.md).

| Character | Role | Personality |
|---|---|---|
| **Nurse Kim** | ICU nurse | Fast, blunt, exhausted. Does CPR, pushes drugs, reads vitals. |
| **Raj** | Pharmacist | Careful, by the book. Prepares drugs, guards the last amiodarone doses. |
| **Dr. Okafor** | Anesthesiologist | Confident, impatient. Controls the airway and the last ventilator; wants it for Bed 4. |
| **Dr. Reyes** | Attending | Calm, senior. Watches from the doorway, coaches rarely, runs the debrief. |
| **Maria Lopez, 58** | Patient | In the bed. Bed 4 (Mr. Chen) appears only as an alarm and a choice. |

## Tech stack

Python owns the patient. The language model only writes what a teammate says. Bruin scores the log after the code ends.

| Layer | Stack | Role in the game |
|---|---|---|
| Client | React 19, TypeScript, Vite, Tailwind CSS, socket.io-client, Recharts | ICU room, voice and text orders, monitor, debrief charts |
| Voice | Chrome Web Speech API | Hold Space or the mic button to give an order |
| API | FastAPI, Uvicorn, python-socketio | One game session per socket. Patient state every 1 second |
| Game rules | Python state machine ([`code_run.py`](server/app/domain/code_run.py)) | CPR, shocks, drugs, the ventilator, and return of pulse |
| Dialogue | [Ollama](https://ollama.com) `stable-beluga` (completion API) | One spoken sentence. Does not decide treatment |
| Agents | [BAND](https://band.ai) room **AWSHackathon** + LangGraph | Spoken lines and whispers are posted to the room. A named teammate answers |
| Warehouse | Postgres on Neon | Orders, vitals, whispers, agent thoughts, collaboration |
| Scoring | [Bruin](https://getbruin.com) (`bruin/codeblue`) | Turns that log into skill scores and the debrief |

A turn looks like this:

1. The player sends an order over the socket.
2. Python matches keywords and updates the patient. The 1-second tick never waits on the model.
3. `stable-beluga` writes the line the teammate speaks.
4. That line is posted to the BAND room. If the line names another teammate, LangGraph asks them for one reply.
5. At the end of the code, Bruin runs over the Postgres log and the debrief reads the analytics tables.

## Repo layout

```
client/      React app (Vite). Live entry: client/src/view/App.tsx
server/      FastAPI + socket.io + Ollama + BAND + Postgres
bruin/       SQL pipeline that scores a finished code
RUNBOOK.md   What to say, and when, while the clock is running
```

Map of the running code: [AGENTS.md](AGENTS.md). Server notes: [server/README.md](server/README.md). Pipeline: [bruin/README.md](bruin/README.md).

## Run it

You need Node 20+, Python 3, [Ollama](https://ollama.com) with `stable-beluga`, the `bruin` CLI, and the Neon connection in `.bruin.yml`. **Google Chrome** is required for voice; typing works in any browser.

```bash
# 1. Model
ollama pull stable-beluga

# 2. API (port 3001)
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 3001

# 3. Client (port 5173)
cd client
npm install
cp .env.example .env
npm run dev
```

`client/.env` must point at the real server. Restart Vite after changing it.

```
VITE_MOCK=false
VITE_SERVER_URL=http://localhost:3001
```

Health: `GET http://127.0.0.1:3001/health`, `GET /ollama/status`, `POST /ollama/ping`.

Then open http://localhost:5173, click **Take the code**, and follow [RUNBOOK.md](RUNBOOK.md). Shortest win: CPR, then epinephrine, then a shock while the rhythm is still V-fib, then give Maria the ventilator at 2:30.

## Socket contract

Source of truth: [`client/src/model/contract.ts`](client/src/model/contract.ts). Default port **3001**, websocket transport, CORS from `http://localhost:5173`.

**Client → server:** `start_run`, `order` (`{ transcript }`), `vent_choice` (`{ choice: "maria" | "bed4" }`), `end_run`.

**Server → client:** `patient` (every 1 s), `agent_reply`, `whisper`, `reyes_note`, `vent_decision`, `run_ended`, `debrief`.

`agent_reply.name` is `Kim`, `Raj`, `Okafor`, or `Reyes`. Emotions are `focused`, `stressed`, `annoyed`, `relieved`, `defiant`. Skill scores are 0 to 100.
