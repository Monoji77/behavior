package com.personalusageanalytics.ingestion.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.Validation;

import org.junit.jupiter.api.Test;

class UsageEventRequestTest {

    @Test
    void acceptsMixedCaseAppNamesAndNormalizesToMillisecondsAndLowercase() {
        UsageEventRequest event = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.parse("2026-08-31T06:24:00.123456789Z"),
                UsageEventRequest.EventType.OPEN,
                "Instagram",
                "unit-test",
                "iphone-test"
        );

        assertTrue(Validation.buildDefaultValidatorFactory().getValidator()
                .validate(event)
                .isEmpty());

        UsageEventRequest normalized = event.normalizedToMilliseconds();

        assertEquals(
                Instant.parse("2026-08-31T06:24:00.123Z"),
                normalized.occurredAt()
        );
        assertEquals("instagram", normalized.app());
        assertEquals(event.eventId(), normalized.eventId());
        assertEquals(event.deviceId(), normalized.deviceId());
    }
}
