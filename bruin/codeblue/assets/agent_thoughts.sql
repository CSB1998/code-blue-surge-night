/* @bruin
name: analytics.agent_thoughts
type: pg.sql
materialization:
  type: table
@bruin */

SELECT
    run_id,
    t_s,
    agent,
    action,
    emotion,
    autonomous,
    reason,
    spoken
FROM raw.agent_decisions
