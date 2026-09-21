package com.personalusageanalytics.ingestion.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.UUID;

import jakarta.validation.Validation;

import org.junit.jupiter.api.Test;

class UsageEventRequestTest {

    @Test
    void acceptsFriendlyShortcutIdentifiersAndNormalizesThemToStableSlugs() {
        UsageEventRequest event = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.parse("2026-08-31T06:24:00.123456789Z"),
                UsageEventRequest.EventType.OPEN,
                "Google Maps",
                "iPhone-Shortcut",
                "iPhone 16 Pro [Personal]"
        );

        assertTrue(Validation.buildDefaultValidatorFactory().getValidator()
                .validate(event)
                .isEmpty());

        UsageEventRequest normalized = event.normalizedToMilliseconds();

        assertEquals(
                Instant.parse("2026-08-31T06:24:00.123Z"),
                normalized.occurredAt()
        );
        assertEquals("google-maps", normalized.app());
        assertEquals("iphone-shortcut", normalized.source());
        assertEquals("iphone-16-pro-personal", normalized.deviceId());
        assertEquals(event.eventId(), normalized.eventId());
    }

    @Test
    void acceptsCloseWithoutAppButRequiresItForOpen() {
        UsageEventRequest close = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.parse("2026-08-31T06:24:00.123456789Z"),
                UsageEventRequest.EventType.CLOSE,
                null,
                "iPhone-Shortcut",
                "iPhone 16 Pro"
        );

        assertTrue(Validation.buildDefaultValidatorFactory().getValidator()
                .validate(close)
                .isEmpty());
        assertNull(close.normalizedToMilliseconds().app());

        UsageEventRequest openWithoutApp = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.now(),
                UsageEventRequest.EventType.OPEN,
                null,
                "unit-test",
                "iphone-test"
        );

        assertFalse(Validation.buildDefaultValidatorFactory().getValidator()
                .validate(openWithoutApp)
                .isEmpty());
    }
}
