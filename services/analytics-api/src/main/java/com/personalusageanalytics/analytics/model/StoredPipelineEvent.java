package com.personalusageanalytics.analytics.model;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record StoredPipelineEvent(
        UUID eventId,
        String kind,
        String app,
        String iconUrl,
        String deviceId,
        Instant at,
        Instant storedAt,
        List<String> closedApps
) {
    public StoredPipelineEvent anonymized() {
        return new StoredPipelineEvent(eventId, kind, null, null, null, at, storedAt, List.of());
    }
}
