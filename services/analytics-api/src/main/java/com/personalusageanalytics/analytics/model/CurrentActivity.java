package com.personalusageanalytics.analytics.model;

import java.time.Instant;

public record CurrentActivity(
        String deviceId,
        String app,
        String iconUrl,
        String status,
        Instant openedAt,
        Instant closedAt,
        Long durationMilliseconds
) {
    public CurrentActivity anonymized() {
        return new CurrentActivity(null, null, null, status, openedAt, closedAt, durationMilliseconds);
    }
}
