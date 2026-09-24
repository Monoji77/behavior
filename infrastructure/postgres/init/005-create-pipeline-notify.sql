-- Announces newly stored activity on channel "pipeline_events" so the
-- analytics API can animate it live on the dashboard's pipeline page:
-- each new OPEN event (with its app) and each completed session (a CLOSE,
-- with the app and duration). Duplicate/replayed events don't fire, because
-- their inserts are skipped by ON CONFLICT DO NOTHING. NOTIFY is delivered
-- only when the writing transaction commits.
--
-- One function per table: raw_app_events is a hypertable whose rows land in
-- chunk tables, so a trigger can't branch on TG_TABLE_NAME.
CREATE OR REPLACE FUNCTION notify_pipeline_open() RETURNS trigger AS $$
BEGIN
    IF NEW.event_type = 'OPEN' AND NEW.app IS NOT NULL THEN
        PERFORM pg_notify('pipeline_events', json_build_object(
            'kind', 'OPEN', 'app', NEW.app, 'deviceId', NEW.device_id, 'at', NEW.occurred_at)::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_pipeline_session() RETURNS trigger AS $$
BEGIN
    IF NEW.status = 'COMPLETED' THEN
        PERFORM pg_notify('pipeline_events', json_build_object(
            'kind', 'CLOSE', 'app', NEW.app, 'deviceId', NEW.device_id, 'at', NEW.closed_at,
            'durationMilliseconds', NEW.duration_milliseconds)::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS raw_app_events_notify ON raw_app_events;
CREATE TRIGGER raw_app_events_notify AFTER INSERT ON raw_app_events
    FOR EACH ROW EXECUTE FUNCTION notify_pipeline_open();

DROP TRIGGER IF EXISTS app_usage_sessions_notify ON app_usage_sessions;
CREATE TRIGGER app_usage_sessions_notify AFTER INSERT ON app_usage_sessions
    FOR EACH ROW EXECUTE FUNCTION notify_pipeline_session();
