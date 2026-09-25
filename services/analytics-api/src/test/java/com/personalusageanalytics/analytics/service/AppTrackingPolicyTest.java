package com.personalusageanalytics.analytics.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class AppTrackingPolicyTest {

    private final AppTrackingPolicy policy = new AppTrackingPolicy();

    @Test
    void excludesGrindrRegardlessOfCaseOrFormatting() {
        assertFalse(policy.isTracked("Grindr"));
        assertFalse(policy.isTracked("GRINDR"));
        assertTrue(policy.isTracked("Instagram"));
    }
}
