# Code Blue: Surge Night

A Track 3 **"Grow with Agents"** training simulation.

It's 2:47 AM in the ICU at City General during a respiratory virus surge. Every bed is full, there is **one ventilator left**, and the heart drug **amiodarone is running low**. You are the doctor leading a cardiac arrest ("code"). You give orders **out loud**. Three AI team members respond, act on screen, push back, and secretly message each other. An attending watches from the doorway and debriefs you at the end.

> Training game only. Simplified medicine. Not medical advice.

| Character | Role | Personality |
|---|---|---|
| **Nurse Kim** | ICU nurse | Fast, blunt, exhausted. Does CPR, pushes drugs, reads vitals. |
| **Raj** | Pharmacist | Careful, by the book. Prepares drugs, guards the last amiodarone doses. |
| **Dr. Okafor** | Anesthesiologist | Confident, impatient. Controls the airway and the last ventilator; wants it for Bed 4. |
| **Dr. Reyes** | Attending | Calm, senior. Watches from the doorway, coaches rarely, runs the debrief. |
| **Maria Lopez, 58** | Patient | In the bed. Bed 4 (Mr. Chen) appears only as an alarm and a choice. |

## Repo layout

```
client/   Frontend: Vite + React + TypeScript + Tailwind (runs on fake data by default)
server/   Backend: Node + Express + socket.io + Ollama + DuckDB + BAND (teammate)
bruin/    Bruin pipeline: SQL assets and checks over codeblue.duckdb
```

## Run the client

Requires Node 20+ and **Google Chrome** (needed for voice input).

```bash
cd client
npm install
cp .env.example .env     # Windows PowerShell: copy .env.example .env
npm run dev              # open http://localhost:5173
```

### Mock mode vs real server

`client/.env`:

```
VITE_MOCK=true                          # true = built-in fake server, false = real socket.io server
VITE_SERVER_URL=http://localhost:3001   # used when VITE_MOCK=false
```

Restart `npm run dev` after changing `.env`.

### Mock mode cheat sheet

Mock mode runs a full 3 to 4 minute code with timers. Orders are matched by keyword: `cpr`/`compressions`, `shock`, `epi`, `amio`, `intubate`, `pulse`/`rhythm check`, `stop cpr`.

- 0:20 the patient goes into V-fib. Stay silent for 10 s and Kim starts CPR on her own.
- 0:45 Dr. Reyes leaves a note.
- About 2:05, V-fib turns into asystole if nobody has shocked.
- 2:30 the ventilator decision appears. Wait 25 s and Okafor takes the vent himself.
- **To win:** CPR, then `Raj, epi 1 milligram`, then `Kim, shock 200 joules`.
- Use names in your orders ("Kim, ...") and ask for confirmation to raise your clarity score.

### Replacing art

Placeholder images live in `client/src/assets/`:

```
characters/{kim,raj,okafor,reyes}/{focused,stressed,annoyed,relieved,defiant}.png   (4:5 portrait)
room.png    (16:9 background)
maria.png   (Maria in the bed, transparent background)
```

Drop in new art with **the same file names**; nothing else needs to change. `npm run placeholders` regenerates the placeholders.

## Screenshots

_Add screenshots here: start screen, code screen, ventilator modal, debrief._

## Socket event contract

The TypeScript source of truth is [`client/src/types/contract.ts`](client/src/types/contract.ts). Keep the two in sync.

### Server → client

| Event | Payload |
|---|---|
| `patient` (every 1 s) | `{ t_s, rhythm: "pre_arrest"\|"VF"\|"asystole"\|"ROSC", hr, spo2, bp: "120/80", cpr_running, shocks, epi_count, amio_left, vent_assigned: "none"\|"maria"\|"bed4" }` |
| `agent_reply` | `{ t_s, name: "Kim"\|"Raj"\|"Okafor", spoken, action, emotion: "focused"\|"stressed"\|"annoyed"\|"relieved"\|"defiant", autonomous: boolean, reason }` |
| `whisper` | `{ t_s, from, to, text }` |
| `reyes_note` | `{ t_s, hint, note }` |
| `vent_decision` | `{ t_s, message }` |
| `run_ended` | `{ maria_outcome: "survived"\|"complications"\|"died", bed4_outcome }` |
| `debrief` | see below |

```ts
debrief: {
  verdict, score,
  skills: { clarity, speed, closed_loop, team_leadership, resource_decision },
  best_moment:  { time, quote, why },
  worst_moment: { time, quote, why },
  team_said_behind_your_back: string[],
  ventilator_call, next_time,
  charts: {
    vitals: [{ t_s, spo2, hr }],
    orders: [{ t_s, transcript, clarity }],
    skill_history: [{ run, clarity, speed, closed_loop, team_leadership, resource_decision }]
  }
}
```

### Client → server

| Event | Payload |
|---|---|
| `start_run` | `{}` |
| `order` | `{ t_s, transcript }` |
| `vent_choice` | `{ choice: "maria"\|"bed4" }` |
| `end_run` | `{}` |

Notes for the server:
- Default port the client connects to: **3001** (socket.io, websocket transport). Allow CORS from `http://localhost:5173`.
- Skill scores are 0 to 100. `hr` can be `0` during arrest; the client shows `---`.
- The client switches to the debrief screen about 2.5 s after `debrief` arrives.
