package com.personalusageanalytics.ingestion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "ingestion")
public record IngestionProperties(
        @NotBlank String collectorToken,
        @NotNull @Valid Topics topics
) {
    public record Topics(
            @NotBlank String rawEvents
    ) {
    }
}