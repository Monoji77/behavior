package com.personalusageanalytics.analytics.model;

public record AnomalyCount(
        String anomalyType,
        long count
) {
}