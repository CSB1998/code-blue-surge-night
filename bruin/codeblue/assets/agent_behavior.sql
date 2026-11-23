/* @bruin
name: analytics.agent_behavior
type: pg.sql
materialization:
  type: table
@bruin */

SELECT
    run_id,
    agent,
    COUNT(*) FILTER (WHERE autonomous) AS autonomous_actions,
    COUNT(*) FILTER (
        WHERE action ILIKE 'refused%'
           OR action ILIKE 'withheld%'
           OR action ILIKE 'could not%'
    ) AS pushbacks,
    COUNT(*) FILTER (
        WHERE NOT autonomous
          AND action NOT ILIKE 'refused%'
          AND action NOT ILIKE 'withheld%'
          AND action NOT ILIKE 'could not%'
    ) AS followed_orders
FROM raw.agent_decisions
GROUP BY run_id, agent
