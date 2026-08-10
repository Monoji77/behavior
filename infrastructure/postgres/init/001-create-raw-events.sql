CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS raw_app_events (
    event_id UUID NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    event_type VARCHAR(10) NOT NULL CHECK (event_type IN ('OPEN', 'CLOSE')),
    app VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    kafka_partition INTEGER,
    kafka_offset BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (event_id, occurred_at)
);

SELECT create_hypertable(
    'raw_app_events',
    by_range('occurred_at'),
    if_not_exists => TRUE
);

-- Queries normally retrieve the most recent events for one device.
CREATE INDEX IF NOT EXISTS raw_app_events_device_time_idx
    ON raw_app_events (device_id, occurred_at DESC);
