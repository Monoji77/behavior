package com.personalusageanalytics.analytics.model;

public record CategoryUsage(String category, long usageMilliseconds, int appCount) {
}
