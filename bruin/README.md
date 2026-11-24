# Bruin

The debrief is filled by the pipeline in [`codeblue/`](codeblue/). The server writes the decision log straight into the `codeblue` Postgres connection in [`.bruin.yml`](../.bruin.yml): orders, agent thoughts (`raw.agent_decisions`), whispers, vitals, and collaboration. The pipeline materializes:

- `analytics.run_scores` — the five skill scores
- `analytics.skill_history` — those scores across runs
- `analytics.agent_behavior` — who acted alone, who pushed back, who followed the order
- `analytics.agent_thoughts` — what each teammate was thinking when they spoke
- `analytics.collaboration` — lines posted to the BAND room
- `analytics.vitals`, `analytics.orders`, `analytics.whispers` — the charts and the "behind your back" list

The pipeline connection is named `codeblue`. Credentials live in the gitignored [`.bruin.yml`](../.bruin.yml) and in Bruin Cloud, and they point at the Neon database `neondb`. Cloud only lists the `analytics` assets above. The `raw` tables stay in Neon and are not Bruin assets.

```bash
bruin run bruin/codeblue
```

The server runs that at the end of every code, then reads the analytics tables for the debrief.
