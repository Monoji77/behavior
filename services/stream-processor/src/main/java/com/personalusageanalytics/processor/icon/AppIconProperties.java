package com.personalusageanalytics.processor.icon;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties(prefix = "processor.app-icons")
public record AppIconProperties(
        @DefaultValue("true") boolean enabled,
        // App Store storefront to search, e.g. SG.
        @DefaultValue("SG") String country,
        @DefaultValue("10") int batchSize,
        // How long to wait before retrying an app that had no match.
        @DefaultValue("P7D") Duration retryAfter
) {
}
