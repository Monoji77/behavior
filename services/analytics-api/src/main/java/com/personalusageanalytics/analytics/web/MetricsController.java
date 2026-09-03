package com.personalusageanalytics.analytics.web;

import java.time.Instant;
import java.util.List;

import com.personalusageanalytics.analytics.model.AnomalyCount;
import com.personalusageanalytics.analytics.model.LatestSession;
import com.personalusageanalytics.analytics.model.RollupGranularity;
import com.personalusageanalytics.analytics.model.UsageRollup;
import com.personalusageanalytics.analytics.persistence.AnalyticsRepository;
import jakarta.validation.constraints.NotBlank;

import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@Validated
@RestController
@RequestMapping("/api/v1/metrics")
public class MetricsController {

    private final AnalyticsRepository analyticsRepository;

    public MetricsController(AnalyticsRepository analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    @GetMapping
    public Object metric(
            @RequestParam @NotBlank String metricName,
            @RequestParam @NotBlank String deviceId,
            @RequestParam @NotBlank String app,
            @RequestParam(required = false) String granularity,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant to
    ) {
        return switch (metricName) {
            case "latest-session" -> latestSession(metricName, deviceId, app);
            case "usage-rollup" -> usageRollups(
                    metricName, deviceId, app, granularity, from, to
            );
            case "anomaly-summary" -> anomalySummary(
                    metricName, deviceId, app, from, to
            );
            default -> throw badRequest(
                    "metricName must be latest-session, usage-rollup, "
                            + "or anomaly-summary."
            );
        };
    }

    private LatestSessionResponse latestSession(
            String metricName,
            String deviceId,
            String app
    ) {
        LatestSession session = analyticsRepository.findLatestSession(deviceId, app)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No session found for the supplied deviceId and app."
                ));

        return new LatestSessionResponse(metricName, session);
    }

    private UsageRollupResponse usageRollups(
            String metricName,
            String deviceId,
            String app,
            String granularity,
            Instant from,
            Instant to
    ) {
        if (granularity == null || granularity.isBlank()) {
            throw badRequest("granularity is required for usage-rollup.");
        }

        validateTimeRange(from, to, "usage-rollup");

        RollupGranularity parsedGranularity = parseGranularity(granularity);

        List<UsageRollup> buckets = analyticsRepository.findUsageRollups(
                deviceId, app, parsedGranularity, from, to
        );

        return new UsageRollupResponse(
                metricName, deviceId, app, parsedGranularity, from, to, buckets
        );
    }

    private AnomalySummaryResponse anomalySummary(
            String metricName,
            String deviceId,
            String app,
            Instant from,
            Instant to
    ) {
        validateTimeRange(from, to, "anomaly-summary");

        List<AnomalyCount> counts = analyticsRepository.findAnomalyCounts(
                deviceId, app, from, to
        );

        long totalAnomalies = counts.stream()
                .mapToLong(AnomalyCount::count)
                .sum();

        return new AnomalySummaryResponse(
                metricName, deviceId, app, from, to, totalAnomalies, counts
        );
    }

    private void validateTimeRange(
            Instant from,
            Instant to,
            String metricName
    ) {
        if (from == null || to == null) {
            throw badRequest(
                    "from and to are required for " + metricName + "."
            );
        }

        if (!from.isBefore(to)) {
            throw badRequest("from must be before to.");
        }
    }

    private RollupGranularity parseGranularity(String granularity) {
        try {
            return RollupGranularity.valueOf(granularity);
        } catch (IllegalArgumentException exception) {
            throw badRequest("granularity must be MINUTE, HOUR, or DAY.");
        }
    }

    private ResponseStatusException badRequest(String detail) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, detail);
    }

    public record LatestSessionResponse(
            String metricName,
            LatestSession session
    ) {
    }

    public record UsageRollupResponse(
            String metricName,
            String deviceId,
            String app,
            RollupGranularity granularity,
            Instant from,
            Instant to,
            List<UsageRollup> buckets
    ) {
    }

    public record AnomalySummaryResponse(
            String metricName,
            String deviceId,
            String app,
            Instant from,
            Instant to,
            long totalAnomalies,
            List<AnomalyCount> counts
    ) {
    }
}