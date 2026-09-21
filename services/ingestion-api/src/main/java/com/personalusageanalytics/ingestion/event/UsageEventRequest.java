package com.personalusageanalytics.ingestion.event;

import java.time.Instant;
import java.util.Locale;
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
        @Pattern(regexp = "^(?=.*[A-Za-z0-9])[^\\p{Cntrl}]+$")
        String app,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^(?=.*[A-Za-z0-9])[^\\p{Cntrl}]+$")
        String source,

        @NotBlank
        @Size(max = 100)
        @Pattern(regexp = "^(?=.*[A-Za-z0-9])[^\\p{Cntrl}]+$")
        String deviceId
    ) {
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
                normalizeIdentifier(app),
                normalizeIdentifier(source),
                normalizeIdentifier(deviceId)
        );
    }

    private static String normalizeIdentifier(String value) {
        if (value == null) {
            return null;
        }

        return value
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }
}
