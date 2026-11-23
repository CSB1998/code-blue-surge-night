/* @bruin
name: analytics.orders
type: pg.sql
materialization:
  type: table
@bruin */

SELECT run_id, t_s, transcript, clarity
FROM raw.orders
