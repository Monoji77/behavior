package com.personalusageanalytics.analytics.model;

public enum BehaviorCategory {
    SOCIAL_AND_ENTERTAINMENT("Social & Entertainment"),
    COMMUNICATION("Communication"),
    WORK_AND_PRODUCTIVITY("Work & Productivity"),
    FINANCE_AND_SHOPPING("Finance & Shopping"),
    HEALTH_AND_LIFESTYLE("Health & Lifestyle"),
    LEARNING("Learning"),
    UTILITIES_AND_NAVIGATION("Utilities & Navigation"),
    OTHER("Other apps");

    private final String label;

    BehaviorCategory(String label) { this.label = label; }

    public String label() { return label; }
}
