/* @bruin
name: analytics.skill_history
type: pg.sql
depends:
  - analytics.run_scores
materialization:
  type: table
@bruin */

SELECT
    ROW_NUMBER() OVER (ORDER BY runs.started_at)::int AS run,
    scores.clarity,
    scores.speed,
    scores.closed_loop,
    scores.team_leadership,
    scores.resource_decision
FROM analytics.run_scores AS scores
JOIN raw.runs AS runs USING (run_id)
