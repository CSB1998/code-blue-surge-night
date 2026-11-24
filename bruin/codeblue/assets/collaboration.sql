/* @bruin
name: analytics.collaboration
type: pg.sql
materialization:
  type: table
@bruin */

SELECT
    run_id,
    t_s,
    speaker,
    mentions,
    body,
    channel
FROM raw.collaboration
