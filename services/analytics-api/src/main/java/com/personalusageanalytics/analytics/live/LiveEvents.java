package com.personalusageanalytics.analytics.live;

import java.time.Instant;
import java.util.Map;
import java.util.function.Function;

import tools.jackson.databind.json.JsonMapper;

// Turns a pipeline_events notification payload into a LiveEvent.
final class LiveEvents {

    private LiveEvents() {
    }

    static LiveEvent fromNotification(String payload, JsonMapper jsonMapper, Function<String, String> iconFor, boolean anonymous) {
        Map<?, ?> fields = jsonMapper.readValue(payload, Map.class);
        String kind = String.valueOf(fields.get("kind"));
        Object at = fields.get("at");
        Object duration = fields.get("durationMilliseconds");
        String app = anonymous ? null : (String) fields.get("app");
        return new LiveEvent(
                kind,
                app,
                app == null ? null : iconFor.apply(app),
                anonymous ? null : (String) fields.get("deviceId"),
                at == null ? null : Instant.parse(normalize(String.valueOf(at))),
                duration instanceof Number number ? number.longValue() : null
        );
    }

    // Postgres renders timestamptz in JSON as "2026-09-24T01:00:00+00:00".
    private static String normalize(String timestamp) {
        return timestamp.endsWith("+00:00") ? timestamp.substring(0, timestamp.length() - 6) + "Z" : timestamp;
    }
}
