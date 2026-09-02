CREATE TABLE IF NOT EXISTS app_usage_rollups (
    device_id VARCHAR(100) NOT NULL,
    app VARCHAR(100) NOT NULL,
    granularity VARCHAR(10) NOT NULL
        CHECK (granularity IN ('MINUTE', 'HOUR', 'DAY')),
    bucket_timezone VARCHAR(64) NOT NULL,
    bucket_start TIMESTAMPTZ NOT NULL,
    usage_milliseconds BIGINT NOT NULL
        CHECK (usage_milliseconds >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (
        device_id,
        app,
        granularity,
        bucket_timezone,
        bucket_start
    )
);

SELECT create_hypertable(
    'app_usage_rollups',
    by_range('bucket_start'),
    if_not_exists => TRUE
);

CREATE INDEX IF NOT EXISTS app_usage_rollups_lookup_idx
    ON app_usage_rollups (
        device_id,
        app,
        granularity,
        bucket_timezone,
        bucket_start DESC
    );