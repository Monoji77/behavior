-- Drop excluded activity before storage and erase existing matching records.
BEGIN;
SET LOCAL lock_timeout = '15s';
CREATE TABLE IF NOT EXISTS excluded_app_fingerprints (
    fingerprint VARCHAR(64) PRIMARY KEY
);
INSERT INTO excluded_app_fingerprints (fingerprint)
VALUES ('1b8c517fe20eeec5f2b7e3f9a413e6bcb455ca3c6895666705a8592ac8e158ff') ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION is_excluded_app(app_name TEXT) RETURNS BOOLEAN AS $fn$
    SELECT EXISTS (
        SELECT 1 FROM public.excluded_app_fingerprints
        WHERE fingerprint = encode(sha256(convert_to(lower(regexp_replace(app_name, '^[[:space:]]+|[[:space:]]+$', '', 'g')), 'UTF8')), 'hex')
    );
$fn$ LANGUAGE SQL STABLE;

CREATE OR REPLACE FUNCTION skip_excluded_app() RETURNS TRIGGER AS $fn$
BEGIN
    IF public.is_excluded_app(NEW.app) THEN
        RETURN NULL;
    END IF;
    RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS exclude_app_before_write ON raw_app_events;
CREATE TRIGGER exclude_app_before_write BEFORE INSERT OR UPDATE ON raw_app_events
    FOR EACH ROW EXECUTE FUNCTION skip_excluded_app();
DROP TRIGGER IF EXISTS exclude_app_before_write ON active_app_sessions;
CREATE TRIGGER exclude_app_before_write BEFORE INSERT OR UPDATE ON active_app_sessions
    FOR EACH ROW EXECUTE FUNCTION skip_excluded_app();
DROP TRIGGER IF EXISTS exclude_app_before_write ON app_usage_sessions;
CREATE TRIGGER exclude_app_before_write BEFORE INSERT OR UPDATE ON app_usage_sessions
    FOR EACH ROW EXECUTE FUNCTION skip_excluded_app();
DROP TRIGGER IF EXISTS exclude_app_before_write ON app_usage_rollups;
CREATE TRIGGER exclude_app_before_write BEFORE INSERT OR UPDATE ON app_usage_rollups
    FOR EACH ROW EXECUTE FUNCTION skip_excluded_app();
DROP TRIGGER IF EXISTS exclude_app_before_write ON app_usage_event_anomalies;
CREATE TRIGGER exclude_app_before_write BEFORE INSERT OR UPDATE ON app_usage_event_anomalies
    FOR EACH ROW EXECUTE FUNCTION skip_excluded_app();
DROP TRIGGER IF EXISTS exclude_app_before_write ON app_icons;
CREATE TRIGGER exclude_app_before_write BEFORE INSERT OR UPDATE ON app_icons
    FOR EACH ROW EXECUTE FUNCTION skip_excluded_app();

DELETE FROM raw_app_events WHERE is_excluded_app(app);
DELETE FROM active_app_sessions WHERE is_excluded_app(app);
DELETE FROM app_usage_sessions WHERE is_excluded_app(app);
DELETE FROM app_usage_rollups WHERE is_excluded_app(app);
DELETE FROM app_usage_event_anomalies WHERE is_excluded_app(app);
DELETE FROM app_icons WHERE is_excluded_app(app);
COMMIT;
