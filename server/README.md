# Server

FastAPI backend that talks to a local [Ollama](https://ollama.com) server. Default model: `stable-beluga` (completion API only).

The client expects this process on **port 3001**. Socket event contract (still to wire): root [README](../README.md#socket-event-contract) and [`client/src/types/contract.ts`](../client/src/types/contract.ts).

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
