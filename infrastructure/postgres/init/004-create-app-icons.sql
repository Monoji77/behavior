-- App Store icon per app, filled by the stream processor's icon lookup job.
-- source: 'itunes' (matched), 'none' (no match yet; retried later), or
-- 'manual' (set by hand; never overwritten by the lookup job).
CREATE TABLE IF NOT EXISTS app_icons (
    app VARCHAR(100) PRIMARY KEY,
    icon_url TEXT,
    source VARCHAR(20) NOT NULL
        CHECK (source IN ('itunes', 'manual', 'none')),
    looked_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
