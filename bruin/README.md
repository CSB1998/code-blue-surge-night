# Bruin

The debrief is filled by the pipeline in [`codeblue/`](codeblue/). It reads the Postgres decision log (`raw.*`) and materializes:

- `analytics.run_scores` — the five skill scores
- `analytics.skill_history` — those scores across runs
- `analytics.agent_behavior` — who acted alone, who pushed back, who followed the order
- `analytics.vitals`, `analytics.orders`, `analytics.whispers` — the charts and the "behind your back" list

Postgres is the local free database `codeblue` on `127.0.0.1:5432`. Credentials are in the gitignored [`.bruin.yml`](../.bruin.yml). Paste that same connection into [Bruin Cloud](https://cloud.getbruin.com/awshackathonnjom8xts/overview) when the database has a public host. Cloud runners cannot reach this laptop.

```bash
bruin run bruin/codeblue
```

The server runs that at the end of every code, then reads the analytics tables for the debrief.
