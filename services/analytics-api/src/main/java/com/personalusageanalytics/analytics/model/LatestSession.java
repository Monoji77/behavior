package com.personalusageanalytics.analytics.model;

import java.time.Instant;
import java.util.UUID;

public record LatestSession(
        UUID sessionId,
        String deviceId,
        String app,
        String source,
        Instant openedAt,
        Instant closedAt,
        Long durationMilliseconds,
        String status,
        int duplicateOpenCount,
        Instant finalizedAt
) {
}