package com.personalusageanalytics.analytics.model;

import java.util.Locale;
import java.util.regex.Pattern;

import com.personalusageanalytics.analytics.privacy.AppExclusions;

// Presentation policy: retained or replayed events must not reintroduce hidden
// apps and diagnostic collectors into analytics or the live activity feed.
public final class DashboardVisibility {
    private static final String TEST_MARKER = "(^|[-_\\s])(test|diagnostic|verification)([-_\\s]|$)";
    private static final Pattern TEST_IDENTIFIER = Pattern.compile(TEST_MARKER, Pattern.CASE_INSENSITIVE);

    private DashboardVisibility() {
    }

    public static boolean isVisible(String deviceId, String app) {
        return isVisibleIdentifier(deviceId) && isVisibleApp(app);
    }

    public static boolean isVisibleApp(String app) {
        return app == null || (!AppExclusions.isExcluded(app) && isVisibleIdentifier(app));
    }

    private static boolean isVisibleIdentifier(String value) {
        return value == null || (!TEST_IDENTIFIER.matcher(value).find()
                && !value.strip().toLowerCase(Locale.ROOT).startsWith("shortcut-check-"));
    }

    // Column names come only from the repository's static queries.
    public static String sql(String deviceColumn, String appColumn) {
        String marker = "'(^|[-_[:space:]])(test|diagnostic|verification)([-_[:space:]]|$)'";
        String app = "NOT is_excluded_app(" + appColumn + ") AND coalesce("
                + appColumn + ", '') !~* " + marker;
        if (deviceColumn == null) return app;
        return app + " AND coalesce(" + deviceColumn + ", '') !~* " + marker
                + " AND lower(btrim(coalesce(" + deviceColumn + ", ''))) NOT LIKE 'shortcut-check-%'";
    }
}
