package com.personalusageanalytics.analytics.live;

import java.time.Instant;

// One piece of activity for the pipeline page's live animation. app/iconUrl/deviceId
// are null when the environment is configured to stream anonymously.
public record LiveEvent(
        String kind,
        String app,
        String iconUrl,
        String deviceId,
        Instant at,
        Long durationMilliseconds
) {
}
