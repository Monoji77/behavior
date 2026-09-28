package com.personalusageanalytics.ingestion.privacy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Set;

// Personal exclusion policy stores normalized name fingerprints.
public final class AppExclusions {
    private static final Set<String> FINGERPRINTS = Set.of("1b8c517fe20eeec5f2b7e3f9a413e6bcb455ca3c6895666705a8592ac8e158ff");

    private AppExclusions() {}

    public static boolean isExcluded(String app) {
        return isExcluded(app, FINGERPRINTS);
    }

    public static boolean isExcluded(String app, Set<String> fingerprints) {
        return app != null && fingerprints.contains(fingerprint(app));
    }

    public static String fingerprint(String app) {
        try {
            byte[] normalized = app.strip().toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
    }
}
