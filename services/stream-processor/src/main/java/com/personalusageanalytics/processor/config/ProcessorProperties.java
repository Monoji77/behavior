package com.personalusageanalytics.processor.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Validated
@ConfigurationProperties(prefix = "processor")
public record ProcessorProperties(
        @NotNull @Valid Topics topics,
        @NotNull @Valid Sessionization sessionization,
        @NotNull @Valid Rollups rollups
) {
        public record Topics(
                @NotBlank String rawEvents,
                @NotBlank String deadLetter
        ) {
        }

        public record Sessionization(
                @NotNull Duration abandonmentTimeout,
                @NotNull Duration abandonmentCheckInterval
        ) {
        }

        public record Rollups(
                @NotBlank String dailyTimeZone
        ) {
        }
}