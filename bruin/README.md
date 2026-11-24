# Bruin

The debrief is filled by the pipeline in [`codeblue/`](codeblue/). It reads the Postgres decision log (`raw.*`) and materializes:

- `analytics.run_scores` — the five skill scores
- `analytics.skill_history` — those scores across runs
- `analytics.agent_behavior` — who acted alone, who pushed back, who followed the order
- `analytics.vitals`, `analytics.orders`, `analytics.whispers` — the charts and the "behind your back" list

The pipeline connection is named `codeblue`. Credentials live in the gitignored [`.bruin.yml`](../.bruin.yml) and in Bruin Cloud, and they point at the Neon database `neondb`. Cloud only lists the `analytics` assets above. The `raw` tables stay in Neon and are not Bruin assets.

```bash
bruin run bruin/codeblue
```

The server runs that at the end of every code, then reads the analytics tables for the debrief.
