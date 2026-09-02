CREATE TABLE IF NOT EXISTS active_app_sessions (
    device_id VARCHAR(100) NOT NULL,
    app VARCHAR(100) NOT NULL,
    open_event_id UUID NOT NULL,
    opened_at TIMESTAMPTZ NOT NULL,
    source VARCHAR(100) NOT NULL,
    duplicate_open_count INTEGER NOT NULL DEFAULT 0
        CHECK (duplicate_open_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (device_id, app),
    UNIQUE (open_event_id)
);

CREATE TABLE IF NOT EXISTS app_usage_sessions (
    session_id UUID PRIMARY KEY,
    device_id VARCHAR(100) NOT NULL,
    app VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    open_event_id UUID NOT NULL UNIQUE,
    close_event_id UUID UNIQUE,
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    duration_milliseconds BIGINT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('COMPLETED', 'ABANDONED')),
    duplicate_open_count INTEGER NOT NULL DEFAULT 0
        CHECK (duplicate_open_count >= 0),
    finalized_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (
        (status = 'COMPLETED'
            AND close_event_id IS NOT NULL
            AND closed_at IS NOT NULL
            AND duration_milliseconds IS NOT NULL
            AND duration_milliseconds >= 0)
        OR
        (status = 'ABANDONED'
            AND close_event_id IS NULL
            AND closed_at IS NULL
            AND duration_milliseconds IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS app_usage_sessions_device_app_opened_idx
    ON app_usage_sessions (device_id, app, opened_at DESC);

CREATE TABLE IF NOT EXISTS app_usage_event_anomalies (
    event_id UUID PRIMARY KEY,
    occurred_at TIMESTAMPTZ NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    app VARCHAR(100) NOT NULL,
    event_type VARCHAR(10) NOT NULL
        CHECK (event_type IN ('OPEN', 'CLOSE')),
    anomaly_type VARCHAR(40) NOT NULL
        CHECK (anomaly_type IN (
            'DUPLICATE_OPEN',
            'UNMATCHED_CLOSE',
            'OUT_OF_ORDER_CLOSE'
        )),
    active_open_event_id UUID,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_usage_event_anomalies_device_time_idx
    ON app_usage_event_anomalies (device_id, occurred_at DESC);