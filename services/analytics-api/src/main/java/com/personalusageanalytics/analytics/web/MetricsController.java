package com.personalusageanalytics.analytics.web;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import com.personalusageanalytics.analytics.model.AnomalyCount;
import com.personalusageanalytics.analytics.model.AppUsageTotal;
import com.personalusageanalytics.analytics.model.BehaviorCategory;
import com.personalusageanalytics.analytics.model.CategoryUsage;
import com.personalusageanalytics.analytics.model.LatestSession;
import com.personalusageanalytics.analytics.model.RollupGranularity;
import com.personalusageanalytics.analytics.model.TopApp;
import com.personalusageanalytics.analytics.model.UsageRollup;
import com.personalusageanalytics.analytics.persistence.AnalyticsRepository;
import com.personalusageanalytics.analytics.service.AppCategoryClassifier;
import com.personalusageanalytics.analytics.service.AppTrackingPolicy;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
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
    private final AppCategoryClassifier appCategoryClassifier;
    private final AppTrackingPolicy appTrackingPolicy;

    public MetricsController(AnalyticsRepository analyticsRepository, AppCategoryClassifier appCategoryClassifier,
            AppTrackingPolicy appTrackingPolicy) {
        this.analyticsRepository = analyticsRepository;
        this.appCategoryClassifier = appCategoryClassifier;
        this.appTrackingPolicy = appTrackingPolicy;
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
        requireTracked(app);
        return switch (metricName) {
            case "latest-session" -> latestSession(metricName, deviceId, app);
            case "longest-session" -> longestSession(metricName, deviceId, app, from, to);
            case "usage-rollup" -> usageRollups(
                    metricName, deviceId, app, granularity, from, to
            );
            case "anomaly-summary" -> anomalySummary(
                    metricName, deviceId, app, from, to
            );
            default -> throw badRequest(
                    "metricName must be latest-session, longest-session, "
                            + "usage-rollup, or anomaly-summary."
            );
        };
    }

    @GetMapping("/filter-options")
    public FilterOptionsResponse filterOptions(
            @RequestParam(required = false) String deviceId,
            @RequestParam(required = false) String app
    ) {
        requireTrackedIfPresent(app);
        Instant earliestUsageAt = (deviceId == null || deviceId.isBlank())
                ? null
                : analyticsRepository.findEarliestBucketStart(deviceId, app).orElse(null);

        List<LocalDate> availableDates = (deviceId == null || deviceId.isBlank())
                ? List.of()
                : analyticsRepository.findAvailableDates(deviceId, app);

        String topApp = (deviceId == null || deviceId.isBlank()) ? null : defaultApp(deviceId);

        return new FilterOptionsResponse(
                analyticsRepository.findDeviceIds(),
                analyticsRepository.findApps(deviceId).stream().filter(appTrackingPolicy::isTracked).toList(),
                earliestUsageAt,
                availableDates,
                topApp,
                analyticsRepository.findAppIcons().entrySet().stream()
                        .filter(entry -> appTrackingPolicy.isTracked(entry.getKey()))
                        .collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue))
        );
    }

    // Everything the dashboard shows for one device/app selection, in one request:
    // the chart's rollups for [from, to), plus the past 7 days' total, longest
    // session and top apps. Keeps an app switch to a single rate-limited call.
    @GetMapping("/dashboard")
    public DashboardResponse dashboard(
            @RequestParam @NotBlank String deviceId,
            @RequestParam @NotBlank String app,
            @RequestParam @NotBlank String granularity,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant to
    ) {
        requireTracked(app);
        validateTimeRange(from, to, "dashboard");
        RollupGranularity parsedGranularity = parseGranularity(granularity);
        Instant weekTo = Instant.now();
        Instant weekFrom = weekTo.minus(Duration.ofDays(7));

        return new DashboardResponse(
                deviceId,
                app,
                parsedGranularity,
                from,
                to,
                analyticsRepository.findUsageRollups(deviceId, app, parsedGranularity, from, to),
                weekFrom,
                weekTo,
                analyticsRepository.findUsageTotal(deviceId, app, weekFrom, weekTo),
                analyticsRepository.findLongestSession(deviceId, app, weekFrom, weekTo).orElse(null),
                analyticsRepository.findTopAppsScoredByToday(deviceId, 3).stream()
                        .filter(topApp -> appTrackingPolicy.isTracked(topApp.app())).toList()
        );
    }

    // The dashboard's default app: today's most-used app so far (the same
    // scoring as the "Top used app" rank), falling back to the most recent day
    // with any usage when nothing has been used yet today.
    private String defaultApp(String deviceId) {
        return analyticsRepository.findTopAppToday(deviceId)
                .or(() -> analyticsRepository.findTopAppOnLatestDay(deviceId))
                .filter(appTrackingPolicy::isTracked)
                .orElse(null);
    }

    @GetMapping("/top-apps")
    public TopAppsResponse topApps(
            @RequestParam @NotBlank String deviceId,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant from,
            @RequestParam
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME)
            Instant to,
            @RequestParam(defaultValue = "3") @Min(1) @Max(10) int limit
    ) {
        validateTimeRange(from, to, "top-apps");

        return new TopAppsResponse(
                deviceId, from, to, analyticsRepository.findTopApps(deviceId, from, to, limit).stream()
                        .filter(topApp -> appTrackingPolicy.isTracked(topApp.app())).toList()
        );
    }

    @GetMapping("/behavior-summary")
    public BehaviorSummaryResponse behaviorSummary(
            @RequestParam @NotBlank String deviceId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to
    ) {
        validateTimeRange(from, to, "behavior-summary");
        Map<BehaviorCategory, CategoryAccumulator> totals = new EnumMap<>(BehaviorCategory.class);
        for (AppUsageTotal appUsage : analyticsRepository.findAppUsageTotals(deviceId, from, to)) {
            if (!appTrackingPolicy.isTracked(appUsage.app())) {
                continue;
            }
            totals.computeIfAbsent(appCategoryClassifier.classify(appUsage.app()), ignored -> new CategoryAccumulator())
                    .add(appUsage.usageMilliseconds());
        }
        List<CategoryUsage> categories = totals.entrySet().stream()
                .map(entry -> new CategoryUsage(entry.getKey().label(), entry.getValue().usageMilliseconds, entry.getValue().appCount))
                .sorted(Comparator.comparingLong(CategoryUsage::usageMilliseconds).reversed().thenComparing(CategoryUsage::category))
                .toList();
        long totalUsageMilliseconds = categories.stream().mapToLong(CategoryUsage::usageMilliseconds).sum();
        int appCount = categories.stream().mapToInt(CategoryUsage::appCount).sum();
        return new BehaviorSummaryResponse(deviceId, from, to, totalUsageMilliseconds, appCount, categories);
    }

    private SessionResponse longestSession(
            String metricName,
            String deviceId,
            String app,
            Instant from,
            Instant to
    ) {
        validateTimeRange(from, to, "longest-session");

        LatestSession session = analyticsRepository.findLongestSession(deviceId, app, from, to)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No completed session found for the supplied deviceId, app and range."
                ));

        return new SessionResponse(metricName, session);
    }

    private SessionResponse latestSession(
            String metricName,
            String deviceId,
            String app
    ) {
        LatestSession session = analyticsRepository.findLatestSession(deviceId, app)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "No session found for the supplied deviceId and app."
                ));

        return new SessionResponse(metricName, session);
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

    private void requireTrackedIfPresent(String app) {
        if (app != null && !app.isBlank()) {
            requireTracked(app);
        }
    }

    private void requireTracked(String app) {
        if (!appTrackingPolicy.isTracked(app)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "The supplied app is excluded from analytics.");
        }
    }

    public record SessionResponse(
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

    public record FilterOptionsResponse(
            List<String> deviceIds,
            List<String> apps,
            Instant earliestUsageAt,
            List<LocalDate> availableDates,
            // Default app for the selected device: most used over the past 7
            // days (else on the most recent day with usage).
            String topApp,
            // App Store icon URL per app, where one was found.
            Map<String, String> appIcons
    ) {
    }

    public record DashboardResponse(
            String deviceId,
            String app,
            RollupGranularity granularity,
            Instant from,
            Instant to,
            List<UsageRollup> buckets,
            Instant weekFrom,
            Instant weekTo,
            long pastWeekMilliseconds,
            LatestSession longestSession,
            List<TopApp> topApps
    ) {
    }

    public record TopAppsResponse(
            String deviceId,
            Instant from,
            Instant to,
            List<TopApp> apps
    ) {
    }

    public record BehaviorSummaryResponse(
            String deviceId,
            Instant from,
            Instant to,
            long totalUsageMilliseconds,
            int appCount,
            List<CategoryUsage> categories
    ) {
    }

    private static final class CategoryAccumulator {
        private long usageMilliseconds;
        private int appCount;

        private void add(long milliseconds) {
            usageMilliseconds += milliseconds;
            appCount++;
        }
    }
}
