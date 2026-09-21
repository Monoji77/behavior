package com.personalusageanalytics.ingestion.event;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.temporal.ChronoUnit;

public record UsageEventRequest(
        @NotNull UUID eventId,

        @NotNull Instant occurredAt,

        @NotNull EventType eventType,

        @NotBlank
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
        return value
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }
}
