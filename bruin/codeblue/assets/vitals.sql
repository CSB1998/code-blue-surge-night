/* @bruin
name: analytics.vitals
type: pg.sql
materialization:
  type: table
@bruin */

SELECT DISTINCT ON (run_id, t_s)
    run_id,
    t_s,
    spo2,
    hr
FROM raw.vitals
ORDER BY run_id, t_s, id
