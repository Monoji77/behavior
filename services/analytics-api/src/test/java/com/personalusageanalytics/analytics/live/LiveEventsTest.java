package com.personalusageanalytics.analytics.live;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class LiveEventsTest {

    private final JsonMapper jsonMapper = JsonMapper.builder().build();

    @Test
    void readsAnOpenWithItsIcon() {
        LiveEvent event = LiveEvents.fromNotification(
                "{\"kind\" : \"OPEN\", \"app\" : \"Telegram\", \"deviceId\" : \"iPhone 16 Pro\", \"at\" : \"2026-09-24T01:00:00+00:00\"}",
                jsonMapper, app -> "https://example.test/" + app + ".png", false);
        assertEquals(new LiveEvent("OPEN", "Telegram", "https://example.test/Telegram.png", "iPhone 16 Pro", Instant.parse("2026-09-24T01:00:00Z"), null), event);
    }

    @Test
    void readsACompletedSessionWithItsDuration() {
        LiveEvent event = LiveEvents.fromNotification(
                "{\"kind\" : \"CLOSE\", \"app\" : \"Telegram\", \"deviceId\" : \"iPhone 16 Pro\", \"at\" : \"2026-09-24T01:02:00+00:00\", \"durationMilliseconds\" : 120000}",
                jsonMapper, app -> null, false);
        assertEquals("CLOSE", event.kind());
        assertEquals(120_000L, event.durationMilliseconds());
        assertNull(event.iconUrl());
    }

    @Test
    void dropsIdentifyingFieldsWhenAnonymous() {
        LiveEvent event = LiveEvents.fromNotification(
                "{\"kind\" : \"OPEN\", \"app\" : \"Telegram\", \"deviceId\" : \"iPhone 16 Pro\", \"at\" : \"2026-09-24T01:00:00+00:00\"}",
                jsonMapper, app -> "https://example.test/icon.png", true);
        assertEquals("OPEN", event.kind());
        assertNull(event.app());
        assertNull(event.iconUrl());
        assertNull(event.deviceId());
    }
}
