package com.personalusageanalytics.analytics.model;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class DashboardVisibilityTest {
    @Test
    void omitsCaseAndWhitespaceVariantsAndKnownDiagnosticDevices() {
        for (String device : new String[] {"iphone-shortcut-test", "diagnostic-vgaplt022", "shortcut-check-20260928043905"}) {
            assertFalse(DashboardVisibility.isVisible(device, "Instagram"));
        }
        assertFalse(DashboardVisibility.isVisible("iPhone 16 Pro", "postman-test"));
        assertFalse(DashboardVisibility.isVisible("iPhone 16 Pro", "connectivity-test"));
    }

    @Test
    void retainsUnnamedClosesAndRealNamesContainingTestLetters() {
        assertTrue(DashboardVisibility.isVisible("iPhone 16 Pro", null));
        assertTrue(DashboardVisibility.isVisible("iPhone 16 Pro", "Latest News"));
        assertTrue(DashboardVisibility.isVisible("iPhone 16 Pro", "Contest"));
    }
}
