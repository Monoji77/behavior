package com.personalusageanalytics.ingestion.event;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.UUID;

import org.junit.jupiter.api.Test;

class UsageEventRequestTest {

    @Test
    void normalizesOccurredAtToMilliseconds() {
        UsageEventRequest event = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.parse("2026-08-31T06:24:00.123456789Z"),
                UsageEventRequest.EventType.OPEN,
                "instagram",
                "unit-test",
                "iphone-test"
        );

        UsageEventRequest normalized = event.normalizedToMilliseconds();

        assertEquals(
                Instant.parse("2026-08-31T06:24:00.123Z"),
                normalized.occurredAt()
        );
        assertEquals(event.eventId(), normalized.eventId());
        assertEquals(event.deviceId(), normalized.deviceId());
    }
}