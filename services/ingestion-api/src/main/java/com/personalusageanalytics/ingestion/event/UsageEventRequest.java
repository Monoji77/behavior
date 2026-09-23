package com.personalusageanalytics.ingestion.event;

import java.time.Instant;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.temporal.ChronoUnit;

public record UsageEventRequest(
        @NotNull UUID eventId,

        @NotNull Instant occurredAt,

        @NotNull EventType eventType,

        @Size(max = 100)
        @Pattern(regexp = IDENTIFIER_PATTERN)
        String app,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = IDENTIFIER_PATTERN)
        String source,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = IDENTIFIER_PATTERN)
        String deviceId
    ) {
    // Identifiers are stored exactly as sent (after trimming surrounding
    // whitespace). Any whitespace is allowed; other control characters are
    // not. Must stay in sync with contracts/app-usage-event.v1.schema.json.
    static final String IDENTIFIER_PATTERN = "^(?=[\\s\\S]*[A-Za-z0-9])(?:\\s|[^\\p{Cntrl}])+$";

    public enum EventType {
        OPEN,
        CLOSE
    }

    @JsonIgnore
    @AssertTrue(message = "app is required for OPEN events")
    public boolean isAppIncludedForOpenEvent() {
        return eventType != EventType.OPEN || (app != null && !app.isBlank());
    }

    public UsageEventRequest normalizedToMilliseconds() {
        return new UsageEventRequest(
                eventId,
                occurredAt.truncatedTo(ChronoUnit.MILLIS),
                eventType,
                trimIdentifier(app),
                trimIdentifier(source),
                trimIdentifier(deviceId)
        );
    }

    private static String trimIdentifier(String value) {
        if (value == null) {
            return null;
        }

        return value.strip();
    }
}
