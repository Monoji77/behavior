package com.personalusageanalytics.analytics.model;

import java.time.Instant;

public record RecentActivity(
        String deviceId,
        String app,
        String iconUrl,
        String status,
        Instant openedAt,
        Instant closedAt,
        Long durationMilliseconds
) {
}
