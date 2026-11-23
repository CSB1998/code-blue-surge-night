/* @bruin
name: analytics.run_scores
type: pg.sql
materialization:
  type: table
columns:
  - name: run_id
    type: varchar
    checks:
      - name: not_null
  - name: clarity
    type: integer
    checks:
      - name: not_null
@bruin */

SELECT
    r.run_id,
    LEAST(100, GREATEST(0, ROUND(COALESCE(r.avg_clarity, 20))))::int AS clarity,
    LEAST(98, GREATEST(10, ROUND(100 - COALESCE(r.seconds_to_first_order, 60) * 4)))::int AS speed,
    LEAST(98, GREATEST(5, ROUND(
        CASE
            WHEN COALESCE(r.order_count, 0) = 0 THEN 15
            ELSE (r.named_order_count::numeric / r.order_count) * 90 + 10
        END
    )))::int AS closed_loop,
    LEAST(98, GREATEST(5,
        85
        - COALESCE(r.autonomous_count, 0) * 12
        - COALESCE(r.clarification_count, 0) * 8
        - COALESCE(r.refusal_count, 0) * 4
        + LEAST(COALESCE(r.order_count, 0), 6) * 2
    ))::int AS team_leadership,
    LEAST(98, GREATEST(5,
        CASE
            WHEN r.vent_chosen_by = 'leader' THEN 85 - GREATEST(0, COALESCE(r.vent_delay_s, 0) - 8) * 2
            WHEN r.vent_chosen_by = 'okafor' THEN 25
            ELSE 40
        END
    ))::int AS resource_decision
FROM raw.runs AS r
WHERE r.ended_at IS NOT NULL
