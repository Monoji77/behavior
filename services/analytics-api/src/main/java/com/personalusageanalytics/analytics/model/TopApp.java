package com.personalusageanalytics.analytics.model;

public record TopApp(
        String app,
        long usageMilliseconds,
        String iconUrl
) {
}
