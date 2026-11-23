# Server

FastAPI backend that talks to a local [Ollama](https://ollama.com) server. Default model: `stable-beluga` (completion API only).

Clean architecture. Dependencies point inward: HTTP and Ollama know about use cases; use cases know about the domain; the domain knows about neither.

```
main.py                         composition root (uvicorn main:app)
app/domain/                     code state machine, entities, errors
app/application/                dialogue, debrief, LanguageModel port
app/infrastructure/             Postgres log, Ollama, BAND room, settings
app/interfaces/http/            FastAPI routes
app/interfaces/socket/          socket.io game gateway
```

The client expects this process on **port 3001**. Set `VITE_MOCK=false` in `client/.env`. The socket contract is [`client/src/model/contract.ts`](../client/src/model/contract.ts).

At the end of a code the server runs `bruin run bruin/codeblue` and the debrief charts, skill scores, and "how the team behaved" lines are read from the analytics tables. See the [Bruin readme](../bruin/README.md).

Agent whispers are @mentions in a collaboration room. Put BAND agent ids and API keys in `agent_config.yaml` at the repo root (gitignored) and those mentions are posted to BAND. A LangGraph adapter can replace that publisher later.

```yaml
kim:
  agent_id: "<from app.band.ai>"
  api_key: "<shown once>"
raj:
  agent_id: ""
  api_key: ""
okafor:
  agent_id: ""
  api_key: ""
reyes:
  agent_id: ""
  api_key: ""
```

## Run

```bash
cd server
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 3001 --reload
```

Ollama must already be running (`ollama serve`) with the model pulled (`ollama pull stable-beluga`).

Override the host or model with `OLLAMA_HOST` and `OLLAMA_MODEL`.

## Check the Ollama connection

```bash
curl http://127.0.0.1:3001/health
curl http://127.0.0.1:3001/ollama/status
curl -X POST http://127.0.0.1:3001/ollama/ping
```

`/ollama/status` checks that Ollama is reachable and `stable-beluga` is installed. `/ollama/ping` asks the model for a short completion so you know inference works. The first ping can take a while while the model loads.
