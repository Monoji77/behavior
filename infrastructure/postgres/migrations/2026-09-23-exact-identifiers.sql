-- One-off: rename identifiers stored as slugs (before #25) to the exact names
-- the iPhone Shortcut now sends, so old and new data line up on the dashboard.
--
-- Run once per environment, staging first:
--   kubectl -n <namespace> exec -i timescaledb-0 -- \
--     sh -c 'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
--     < infrastructure/postgres/migrations/2026-09-23-exact-identifiers.sql
--
-- Safe while the stream processor is running: the tables are locked against
-- writes (reads still work) for the few milliseconds the transaction takes, and
-- the processor's writes simply wait. Idempotent: a second run finds nothing
-- to rename. Test/diagnostic identifiers are intentionally left unchanged.
--
-- Kafka still retains the original slug events, so a staging consumer group
-- replayed from the beginning would reintroduce slugs; rerun this afterwards.

BEGIN;

LOCK TABLE raw_app_events, active_app_sessions, app_usage_sessions,
    app_usage_event_anomalies, app_usage_rollups IN EXCLUSIVE MODE;

CREATE TEMP TABLE identifier_map (
    kind TEXT NOT NULL CHECK (kind IN ('device', 'source', 'app')),
    old_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    PRIMARY KEY (kind, old_value)
) ON COMMIT DROP;

INSERT INTO identifier_map (kind, old_value, new_value) VALUES
    ('device', 'iphone-16-pro', 'iPhone 16 Pro'),
    ('source', 'iphone-shortcut', 'iPhone Shortcut'),
    ('app', 'anywheel', 'Anywheel'),
    ('app', 'calculator', 'Calculator'),
    ('app', 'calendar', 'Calendar'),
    ('app', 'camera', 'Camera'),
    ('app', 'chatgpt', 'ChatGPT'),
    ('app', 'citibank-sg', 'Citibank SG'),
    ('app', 'dbs-digibank', 'DBS digibank'),
    ('app', 'dbs-paylah', 'DBS PayLah!'),
    ('app', 'discord', 'Discord'),
    ('app', 'disney', 'Disney+'),
    ('app', 'excel', 'Excel'),
    ('app', 'github', 'GitHub'),
    ('app', 'google', 'Google'),
    ('app', 'google-maps', 'Google Maps'),
    ('app', 'google-pay-singapore', 'Google Pay Singapore'),
    ('app', 'grindr', 'Grindr'),
    ('app', 'helloride', 'HelloRide'),
    ('app', 'instagram', 'Instagram'),
    ('app', 'jira', 'Jira'),
    ('app', 'kris', 'Kris+'),
    ('app', 'mail', 'Mail'),
    ('app', 'messages', 'Messages'),
    ('app', 'netflix', 'Netflix'),
    ('app', 'notes', 'Notes'),
    ('app', 'outlook', 'Outlook'),
    ('app', 'phone', 'Phone'),
    ('app', 'priority-pass', 'Priority Pass'),
    ('app', 'safari', 'Safari'),
    ('app', 'settings', 'Settings'),
    ('app', 'shopee', 'Shopee'),
    ('app', 'shortcuts', 'Shortcuts'),
    ('app', 'singaporeair', 'SingaporeAir'),
    ('app', 'spotify', 'Spotify'),
    ('app', 'tailscale', 'Tailscale'),
    ('app', 'telegram', 'Telegram'),
    ('app', 'tiktok', 'TikTok'),
    ('app', 'trip-com', 'Trip.com'),
    ('app', 'uob-tmrw', 'UOB TMRW'),
    ('app', 'wallet', 'Wallet'),
    ('app', 'weather', 'Weather'),
    ('app', 'whatsapp', 'WhatsApp'),
    ('app', 'x', 'X');

CREATE TEMP TABLE usage_before ON COMMIT DROP AS
    SELECT granularity, sum(usage_milliseconds) AS total
    FROM app_usage_rollups GROUP BY granularity;

-- Rows are only ever renamed, never removed; these counts must not change.
CREATE TEMP TABLE rows_before ON COMMIT DROP AS
    SELECT (SELECT count(*) FROM raw_app_events) AS raw_events,
           (SELECT count(*) FROM app_usage_sessions) AS sessions,
           (SELECT count(*) FROM app_usage_event_anomalies) AS anomalies;

-- An open session under both the old and the new name would collide on the
-- (device_id, app) key; stop rather than guess which one is real.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM active_app_sessions old_session
        LEFT JOIN identifier_map d ON d.kind = 'device' AND d.old_value = old_session.device_id
        LEFT JOIN identifier_map a ON a.kind = 'app' AND a.old_value = old_session.app
        JOIN active_app_sessions new_session
            ON new_session.device_id = coalesce(d.new_value, old_session.device_id)
           AND new_session.app = coalesce(a.new_value, old_session.app)
        WHERE d.old_value IS NOT NULL OR a.old_value IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'An active session exists under both an old and a new name; close apps and retry';
    END IF;
END $$;

-- Plain renames: none of these tables has a unique key on the renamed columns.
UPDATE raw_app_events t SET device_id = m.new_value FROM identifier_map m WHERE m.kind = 'device' AND t.device_id = m.old_value;
UPDATE raw_app_events t SET source = m.new_value FROM identifier_map m WHERE m.kind = 'source' AND t.source = m.old_value;
UPDATE raw_app_events t SET app = m.new_value FROM identifier_map m WHERE m.kind = 'app' AND t.app = m.old_value;

UPDATE app_usage_sessions t SET device_id = m.new_value FROM identifier_map m WHERE m.kind = 'device' AND t.device_id = m.old_value;
UPDATE app_usage_sessions t SET source = m.new_value FROM identifier_map m WHERE m.kind = 'source' AND t.source = m.old_value;
UPDATE app_usage_sessions t SET app = m.new_value FROM identifier_map m WHERE m.kind = 'app' AND t.app = m.old_value;

UPDATE app_usage_event_anomalies t SET device_id = m.new_value FROM identifier_map m WHERE m.kind = 'device' AND t.device_id = m.old_value;
UPDATE app_usage_event_anomalies t SET app = m.new_value FROM identifier_map m WHERE m.kind = 'app' AND t.app = m.old_value;

UPDATE active_app_sessions t SET device_id = m.new_value FROM identifier_map m WHERE m.kind = 'device' AND t.device_id = m.old_value;
UPDATE active_app_sessions t SET source = m.new_value FROM identifier_map m WHERE m.kind = 'source' AND t.source = m.old_value;
UPDATE active_app_sessions t SET app = m.new_value FROM identifier_map m WHERE m.kind = 'app' AND t.app = m.old_value;

-- Rollups are keyed by (device_id, app, bucket): a bucket may already hold
-- usage under the new name, so move old-name usage into it by adding.
CREATE TEMP TABLE moved_rollups ON COMMIT DROP AS
    SELECT coalesce(d.new_value, r.device_id) AS device_id,
           coalesce(a.new_value, r.app) AS app,
           r.granularity, r.bucket_timezone, r.bucket_start,
           sum(r.usage_milliseconds) AS usage_milliseconds
    FROM app_usage_rollups r
    LEFT JOIN identifier_map d ON d.kind = 'device' AND d.old_value = r.device_id
    LEFT JOIN identifier_map a ON a.kind = 'app' AND a.old_value = r.app
    WHERE d.old_value IS NOT NULL OR a.old_value IS NOT NULL
    GROUP BY 1, 2, 3, 4, 5;

DELETE FROM app_usage_rollups r
USING identifier_map m
WHERE (m.kind = 'device' AND r.device_id = m.old_value)
   OR (m.kind = 'app' AND r.app = m.old_value);

INSERT INTO app_usage_rollups (device_id, app, granularity, bucket_timezone, bucket_start, usage_milliseconds, updated_at)
SELECT device_id, app, granularity, bucket_timezone, bucket_start, usage_milliseconds, NOW()
FROM moved_rollups
ON CONFLICT (device_id, app, granularity, bucket_timezone, bucket_start) DO UPDATE
SET usage_milliseconds = app_usage_rollups.usage_milliseconds + EXCLUDED.usage_milliseconds,
    updated_at = NOW();

-- Invariants: total usage and row counts are unchanged, and no old name remains.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM usage_before b
        FULL JOIN (SELECT granularity, sum(usage_milliseconds) AS total FROM app_usage_rollups GROUP BY granularity) a
            USING (granularity)
        WHERE b.total IS DISTINCT FROM a.total
    ) THEN
        RAISE EXCEPTION 'Total rollup usage changed; rolling back';
    END IF;
    IF (SELECT raw_events FROM rows_before) <> (SELECT count(*) FROM raw_app_events)
       OR (SELECT sessions FROM rows_before) <> (SELECT count(*) FROM app_usage_sessions)
       OR (SELECT anomalies FROM rows_before) <> (SELECT count(*) FROM app_usage_event_anomalies) THEN
        RAISE EXCEPTION 'Row counts changed; rolling back';
    END IF;
    IF EXISTS (SELECT 1 FROM identifier_map m WHERE
               (m.kind = 'device' AND EXISTS (SELECT 1 FROM raw_app_events WHERE device_id = m.old_value))
            OR (m.kind = 'source' AND EXISTS (SELECT 1 FROM raw_app_events WHERE source = m.old_value))
            OR (m.kind = 'app' AND EXISTS (SELECT 1 FROM raw_app_events WHERE app = m.old_value))
            OR (m.kind = 'app' AND EXISTS (SELECT 1 FROM app_usage_rollups WHERE app = m.old_value))
            OR (m.kind = 'device' AND EXISTS (SELECT 1 FROM app_usage_rollups WHERE device_id = m.old_value))) THEN
        RAISE EXCEPTION 'Old identifiers remain; rolling back';
    END IF;
END $$;

SELECT 'renamed' AS result,
       (SELECT count(*) FROM raw_app_events WHERE device_id = 'iPhone 16 Pro') AS iphone_events,
       (SELECT count(*) FROM app_usage_sessions WHERE device_id = 'iPhone 16 Pro') AS iphone_sessions,
       (SELECT count(DISTINCT app) FROM app_usage_rollups WHERE device_id = 'iPhone 16 Pro') AS iphone_apps_with_usage;

COMMIT;
