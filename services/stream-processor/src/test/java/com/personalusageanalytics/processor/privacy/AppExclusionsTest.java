package com.personalusageanalytics.processor.privacy;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AppExclusionsTest {
    @Test
    void matchesNormalizedFingerprintsAndAllowsUnrelatedAppsAndUnnamedCloses() {
        Set<String> excluded = Set.of(AppExclusions.fingerprint("Private Example"));
        assertTrue(AppExclusions.isExcluded("  pRiVaTe EXAMPLE  ", excluded));
        assertFalse(AppExclusions.isExcluded("Telegram", excluded));
        assertFalse(AppExclusions.isExcluded(null, excluded));
    }
}
