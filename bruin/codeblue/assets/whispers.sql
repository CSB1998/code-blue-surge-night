/* @bruin
name: analytics.whispers
type: pg.sql
materialization:
  type: table
@bruin */

SELECT
    run_id,
    t_s,
    from_agent || ' to ' || to_agent || ': "' || text || '"' AS line
FROM raw.whispers
