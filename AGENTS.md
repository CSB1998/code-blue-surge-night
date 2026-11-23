# Code Blue: Surge Night — agent index

Start here. This is the map of the running app. The root [README.md](README.md) still describes the mock client and DuckDB; trust this file instead.

## Index

1. [What the product does](#1-what-the-product-does)
2. [Run it](#2-run-it)
3. [Where to edit](#3-where-to-edit)
4. [Game rules the code owns](#4-game-rules-the-code-owns)
5. [Socket contract](#5-socket-contract)
6. [Dialogue model](#6-dialogue-model)
7. [Postgres and Bruin](#7-postgres-and-bruin)
8. [BAND and LangGraph](#8-band-and-langgraph)
9. [Do not touch](#9-do-not-touch)

## 1. What the product does

ICU cardiac-arrest training game. The player leads a code at 2:47 AM. One ventilator is left and amiodarone is low. Orders are voice or text. Nurse Kim, pharmacist Raj, Dr. Okafor, and attending Dr. Reyes speak, push back, and whisper.

Python decides CPR, shocks, drugs, the ventilator, and return of pulse. `stable-beluga` only writes lines. Spoken lines and whispers go to the BAND room **AWSHackathon**. A LangGraph turn lets a named teammate answer. At the end of a code, Bruin scores the Postgres log and the debrief reads those tables.

## 2. Run it

| Process | Command | Port |
|---|---|---|
| Client | `cd client && npm run dev` | 5173 |
| API | `cd server && .venv/bin/uvicorn main:app --host 127.0.0.1 --port 3001` | 3001 |
| Ollama | already running, model `stable-beluga` | 11434 |
| Postgres | local database `codeblue`, user `siddharth`, no password | 5432 |

`client/.env` (gitignored) must have `VITE_MOCK=false` and `VITE_SERVER_URL=http://localhost:3001`. Restart Vite after changing it.

Health: `GET http://127.0.0.1:3001/health`, `GET /ollama/status`, `POST /ollama/ping`.

## 3. Where to edit

Live client entry is [client/src/main.tsx](client/src/main.tsx), which renders [client/src/view/App.tsx](client/src/view/App.tsx).

| Concern | File |
|---|---|
| Screens | [client/src/view/screens/](client/src/view/screens/) — `StartScreen.tsx`, `CodeScreen.tsx`, `DebriefScreen.tsx` |
| Room, cards, monitor | [client/src/view/components/](client/src/view/components/) |
| Socket hook and voice | [client/src/controller/useCodeRun.ts](client/src/controller/useCodeRun.ts), [transport.ts](client/src/controller/transport.ts) |
| Event types | [client/src/model/contract.ts](client/src/model/contract.ts) |
| Portraits | [client/src/model/characters.ts](client/src/model/characters.ts) and `client/src/assets/characters/<id>/<emotion>.jpg` |
| API composition | [server/main.py](server/main.py), [server/app/interfaces/http/app.py](server/app/interfaces/http/app.py) |
| Socket session | [server/app/interfaces/socket/gateway.py](server/app/interfaces/socket/gateway.py) |
| State machine | [server/app/domain/code_run.py](server/app/domain/code_run.py) |
| One spoken sentence | [server/app/application/voice.py](server/app/application/voice.py) |
| LangGraph turn | [server/app/application/collab.py](server/app/application/collab.py) |
| BAND room | [server/app/infrastructure/band_room.py](server/app/infrastructure/band_room.py) |
| Decision log | [server/app/infrastructure/store.py](server/app/infrastructure/store.py) |
| Debrief from Bruin | [server/app/application/debrief.py](server/app/application/debrief.py) |
| Settings | [server/app/infrastructure/config.py](server/app/infrastructure/config.py) |
| Bruin pipeline | [bruin/codeblue/pipeline.yml](bruin/codeblue/pipeline.yml), [bruin/README.md](bruin/README.md) |
| Server notes | [server/README.md](server/README.md) |

Ignore these leftovers. Nothing in the running app imports them:

- `server/app/domain/simulation.py` (older copy of the state machine)
- `client/src/components/`, `client/src/screens/`, `client/src/data/`, `client/src/state/`, `client/src/lib/`, `client/src/types/`

## 4. Game rules the code owns

Implemented in [code_run.py](server/app/domain/code_run.py). The model must not change these.

- 0:20 the patient goes into V-fib. Silence for about 10 seconds and Kim starts CPR on her own.
- About 0:45 Dr. Reyes leaves a note.
- About 2:05, V-fib becomes asystole if nobody has shocked.
- 2:30 the ventilator choice appears. If the leader waits, Okafor takes it.
- A win is CPR, then epinephrine, then a shock while the rhythm is still V-fib.
- Orders match keywords: `cpr`, `shock`, `epi`, `amio`, `intubate`, `pulse` / `rhythm check`, `stop cpr`. Names in the order ("Kim, ...") raise the clarity score.

## 5. Socket contract

Source of truth: [client/src/model/contract.ts](client/src/model/contract.ts).

Client sends `start_run`, `order` (`{ transcript }`), `vent_choice` (`{ choice: "maria" | "bed4" }`), `end_run`.

Server sends `patient` (every 1s), `agent_reply`, `whisper`, `reyes_note`, `vent_decision`, `run_ended`, `debrief`.

`agent_reply.name` is `Kim`, `Raj`, `Okafor`, or `Reyes`. Emotions are `focused`, `stressed`, `annoyed`, `relieved`, `defiant`.

One `GameSession` per socket id. The 1-second tick must not wait on Ollama or BAND. Collaboration is scheduled as a task in the gateway.

## 6. Dialogue model

Ollama at `http://127.0.0.1:11434`, model `stable-beluga`. Completion only: `POST /api/generate`. No chat API and no tools.

Prompt shape is `### System:` / `### User:` / `### Assistant:`. Do not put the fallback sentence in the prompt; the model copies it. A line over 240 characters or an empty line is discarded. Generation is slow (on the order of a minute). Timeout in [voice.py](server/app/application/voice.py) is 90 seconds.

Portraits: Kim, Raj, and Okafor are `.jpg` (480×600). Reyes is still the `.png` placeholder. [characters.ts](client/src/model/characters.ts) prefers `.jpg`. Vite only notices a new portrait file on restart.

## 7. Postgres and Bruin

DSN default: `postgresql://siddharth@127.0.0.1:5432/codeblue`. Override with `DATABASE_URL` in `server/.env` (gitignored).

[store.py](server/app/infrastructure/store.py) writes `raw.runs`, `raw.orders`, `raw.agent_decisions`, `raw.whispers`, `raw.vitals`, `raw.collaboration`.

At the end of a code the server runs `bruin run bruin/codeblue` with cwd at the repo root, then reads:

- `analytics.run_scores` — clarity, speed, closed loop, team leadership, resource decision
- `analytics.skill_history`
- `analytics.agent_behavior`
- `analytics.vitals`, `analytics.orders`, `analytics.whispers`

Pipeline assets: [bruin/codeblue/assets/](bruin/codeblue/assets/). Connection file is gitignored `.bruin.yml`. Bruin Cloud cannot reach this laptop. Do not use DuckDB.

## 8. BAND and LangGraph

Room title is `AWSHackathon`. Id `c195a1bf-26c2-4d22-9d9f-b08aecc9523e`. All four agents are already in it. Do not create a new room per code.

Keys live in gitignored [agent_config.yaml](agent_config.yaml). Names must be lowercase: `kim`, `raj`, `okafor`, `reyes`. Each entry has `agent_id` and `api_key`. Never print the keys.

API base is `https://api.band.ai/api/v1/agent`. Header is `X-API-Key`. A message must @mention someone who is in the room: `POST /chats/{id}/messages` with `{ "message": { "content", "mentions": [{ "id", "handle", "name" }] } }`. Handles are `siddumbre23/kim`, `siddumbre23/raj`, `siddumbre23/okafor`, `siddumbre23/reyes`.

[collab.py](server/app/application/collab.py) is the LangGraph graph: `announce` posts the game line, `respond` runs only when another character was named, then posts that answer and the gateway shows it as an `agent_reply`. One model call at a time (`_model_lock` in the room).

## 9. Do not touch

- Do not commit `.env`, `.bruin.yml`, or `agent_config.yaml`.
- Do not block the socket tick on Ollama or BAND.
- Do not let the model decide shocks, drugs, the ventilator, or the outcome.
- Do not point Bruin at DuckDB.
- Do not edit the leftover client folders or `simulation.py` unless the task is to delete them.
