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
    void acceptsFriendlyShortcutIdentifiersAndKeepsThemExactlyAsSent() {
        UsageEventRequest event = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.parse("2026-08-31T06:24:00.123456789Z"),
                UsageEventRequest.EventType.OPEN,
                "  Google Maps\n",
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
        assertEquals("Google Maps", normalized.app());
        assertEquals("iPhone-Shortcut", normalized.source());
        assertEquals("iPhone 16 Pro [Personal]", normalized.deviceId());
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

    @Test
    void acceptsAnyWhitespaceButRejectsOtherControlCharacters() {
        var validator = Validation.buildDefaultValidatorFactory().getValidator();

        for (String app : new String[] {"Google Maps", "Google\tMaps", "Google\nMaps", "Google\r\nMaps"}) {
            assertTrue(validator.validate(open(app)).isEmpty(), app);
        }
        for (String app : new String[] {"Google\u0000Maps", "Google\u001BMaps", "Google\u007FMaps", " \t ", "---"}) {
            assertFalse(validator.validate(open(app)).isEmpty(), app);
        }
    }

    private static UsageEventRequest open(String app) {
        return new UsageEventRequest(
                UUID.randomUUID(),
                Instant.now(),
                UsageEventRequest.EventType.OPEN,
                app,
                "unit-test",
                "iphone-test"
        );
    }
}
