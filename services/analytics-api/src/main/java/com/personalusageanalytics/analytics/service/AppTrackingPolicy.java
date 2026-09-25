package com.personalusageanalytics.analytics.service;

import java.util.Locale;
import java.util.Set;

import org.springframework.stereotype.Component;

/** Apps deliberately excluded from analytics views. Their stored history is retained. */
@Component
public class AppTrackingPolicy {
    private static final Set<String> EXCLUDED_APPS = Set.of("grindr");

    public boolean isTracked(String app) {
        String normalized = app == null ? "" : app.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return !EXCLUDED_APPS.contains(normalized);
    }
}
