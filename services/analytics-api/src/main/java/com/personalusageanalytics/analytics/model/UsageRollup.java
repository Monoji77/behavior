package com.personalusageanalytics.analytics.model;

import java.time.Instant;

public record UsageRollup(
        String deviceId,
        String app,
        RollupGranularity granularity,
        String bucketTimezone,
        Instant bucketStart,
        long usageMilliseconds,
        Instant updatedAt
) {
}