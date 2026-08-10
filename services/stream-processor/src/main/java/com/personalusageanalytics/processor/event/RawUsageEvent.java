package com.personalusageanalytics.processor.event;

import java.time.Instant;
import java.util.UUID;

public record RawUsageEvent(
        UUID eventId,
        Instant occurredAt,
        EventType eventType,
        String app,
        String source,
        String deviceId
) {
    public enum EventType {
        OPEN,
        CLOSE
    }
}