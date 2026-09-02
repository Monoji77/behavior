package com.personalusageanalytics.processor.rollup;

import java.sql.Timestamp;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class UsageRollupRepository {

    private static final String UPSERT_USAGE_ROLLUP = """
            INSERT INTO app_usage_rollups (
                device_id,
                app,
                granularity,
                bucket_timezone,
                bucket_start,
                usage_milliseconds
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (
                device_id,
                app,
                granularity,
                bucket_timezone,
                bucket_start
            ) DO UPDATE SET
                usage_milliseconds =
                    app_usage_rollups.usage_milliseconds
                    + EXCLUDED.usage_milliseconds,
                updated_at = NOW()
            """;

    private final JdbcTemplate jdbcTemplate;

    public UsageRollupRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void addUsage(
            String deviceId,
            String app,
            UsageBucketAllocator.Granularity granularity,
            String bucketTimezone,
            UsageBucketAllocator.UsageSlice slice
    ) {
        jdbcTemplate.update(
                UPSERT_USAGE_ROLLUP,
                deviceId,
                app,
                granularity.name(),
                bucketTimezone,
                Timestamp.from(slice.bucketStart()),
                slice.usageMilliseconds()
        );
    }
}