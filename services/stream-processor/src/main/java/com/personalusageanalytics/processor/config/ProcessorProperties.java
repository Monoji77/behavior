package com.personalusageanalytics.processor.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "processor")
public record ProcessorProperties(
        @NotNull @Valid Topics topics
) {
    public record Topics(
            @NotBlank String rawEvents,
            @NotBlank String deadLetter
    ) {
    }
}