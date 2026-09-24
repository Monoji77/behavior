package com.personalusageanalytics.analytics.persistence;

import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.time.Instant;
import java.time.LocalDate;


import com.personalusageanalytics.analytics.model.LatestSession;
import com.personalusageanalytics.analytics.model.RollupGranularity;
import com.personalusageanalytics.analytics.model.UsageRollup;
import com.personalusageanalytics.analytics.model.AnomalyCount;
import com.personalusageanalytics.analytics.model.TopApp;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

// Converts SQL rows into java objects
@Repository
public class AnalyticsRepository {

    private static final String FIND_LATEST_SESSION = """
            SELECT
                session_id,
                device_id,
                app,
                source,
                opened_at,
                closed_at,
                duration_milliseconds,
                status,
                duplicate_open_count,
                finalized_at
            FROM app_usage_sessions
            WHERE device_id = ?
              AND app = ?
            ORDER BY opened_at DESC
            LIMIT 1
            """;
    private static final String FIND_LONGEST_SESSION = """
            SELECT
                session_id,
                device_id,
                app,
                source,
                opened_at,
                closed_at,
                duration_milliseconds,
                status,
                duplicate_open_count,
                finalized_at
            FROM app_usage_sessions
            WHERE device_id = ?
              AND app = ?
              AND status = 'COMPLETED'
              AND opened_at >= ?
              AND opened_at < ?
            ORDER BY duration_milliseconds DESC, opened_at DESC
            LIMIT 1
            """;
    private static final String FIND_USAGE_ROLLUPS = """
            SELECT
                device_id,
                app,
                granularity,
                bucket_timezone,
                bucket_start,
                usage_milliseconds,
                updated_at
            FROM app_usage_rollups
            WHERE device_id = ?
            AND app = ?
            AND granularity = ?
            AND bucket_start >= ?
            AND bucket_start < ?
            ORDER BY bucket_start ASC
            """;

    private static final String FIND_ANOMALY_COUNTS = """
            SELECT
                anomaly_type,
                COUNT(*) AS anomaly_count
            FROM app_usage_event_anomalies
            WHERE device_id = ?
            AND app = ?
            AND occurred_at >= ?
            AND occurred_at < ?
            GROUP BY anomaly_type
            ORDER BY anomaly_type ASC
            """;
    private static final String FIND_DEVICE_IDS = """
            SELECT DISTINCT device_id
            FROM app_usage_rollups
            ORDER BY device_id ASC
            """;
    private static final String FIND_APPS = """
            SELECT DISTINCT app
            FROM app_usage_rollups
            ORDER BY app ASC
            """;
    private static final String FIND_APPS_FOR_DEVICE = """
            SELECT DISTINCT app
            FROM app_usage_rollups
            WHERE device_id = ?
            ORDER BY app ASC
            """;
    private static final String FIND_EARLIEST_BUCKET_START_FOR_DEVICE = """
            SELECT MIN(bucket_start) AS earliest_bucket_start
            FROM app_usage_rollups
            WHERE device_id = ?
            """;
    private static final String FIND_EARLIEST_BUCKET_START_FOR_DEVICE_AND_APP = """
            SELECT MIN(bucket_start) AS earliest_bucket_start
            FROM app_usage_rollups
            WHERE device_id = ?
            AND app = ?
            """;
    private static final String FIND_AVAILABLE_DATES_FOR_DEVICE = """
            SELECT DISTINCT (bucket_start AT TIME ZONE bucket_timezone)::date AS usage_date
            FROM app_usage_rollups
            WHERE device_id = ?
            ORDER BY usage_date ASC
            """;
    private static final String FIND_AVAILABLE_DATES_FOR_DEVICE_AND_APP = """
            SELECT DISTINCT (bucket_start AT TIME ZONE bucket_timezone)::date AS usage_date
            FROM app_usage_rollups
            WHERE device_id = ?
            AND app = ?
            ORDER BY usage_date ASC
            """;
    // Daily buckets are already cut at local midnight (bucket_timezone), so the
    // most recent day with usage is today whenever there is any usage today.
    private static final String FIND_TOP_APP_ON_LATEST_DAY = """
            SELECT app
            FROM app_usage_rollups
            WHERE device_id = ?
            AND granularity = 'DAY'
            AND usage_milliseconds > 0
            GROUP BY app, bucket_start
            ORDER BY bucket_start DESC, SUM(usage_milliseconds) DESC, app ASC
            LIMIT 1
            """;
    private static final String FIND_APP_ICONS = """
            SELECT app, icon_url
            FROM app_icons
            WHERE icon_url IS NOT NULL
            """;
    // Hourly buckets (one timezone) give an exact [from, to) window.
    private static final String FIND_TOP_APPS = """
            SELECT r.app, SUM(r.usage_milliseconds) AS usage_milliseconds, i.icon_url
            FROM app_usage_rollups r
            LEFT JOIN app_icons i ON i.app = r.app
            WHERE r.device_id = ?
              AND r.granularity = 'HOUR'
              AND r.bucket_start >= ?
              AND r.bucket_start < ?
            GROUP BY r.app, i.icon_url
            HAVING SUM(r.usage_milliseconds) > 0
            ORDER BY usage_milliseconds DESC, r.app ASC
            LIMIT ?
            """;
    private static final String FIND_USAGE_TOTAL = """
            SELECT COALESCE(SUM(usage_milliseconds), 0)
            FROM app_usage_rollups
            WHERE device_id = ?
              AND app = ?
              AND granularity = 'HOUR'
              AND bucket_start >= ?
              AND bucket_start < ?
            """;
    private final JdbcTemplate jdbcTemplate;

    public AnalyticsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static final RowMapper<LatestSession> SESSION_ROW_MAPPER = (resultSet, rowNumber) -> {
        Timestamp closedAt = resultSet.getTimestamp("closed_at");

        return new LatestSession(
                resultSet.getObject("session_id", UUID.class),
                resultSet.getString("device_id"),
                resultSet.getString("app"),
                resultSet.getString("source"),
                resultSet.getTimestamp("opened_at").toInstant(),
                closedAt == null ? null : closedAt.toInstant(),
                resultSet.getObject("duration_milliseconds", Long.class),
                resultSet.getString("status"),
                resultSet.getInt("duplicate_open_count"),
                resultSet.getTimestamp("finalized_at").toInstant()
        );
    };

    public Optional<LatestSession> findLatestSession(String deviceId, String app) {
        return jdbcTemplate.query(FIND_LATEST_SESSION, SESSION_ROW_MAPPER, deviceId, app)
                .stream().findFirst();
    }

    // Longest completed session opened within [from, to).
    public Optional<LatestSession> findLongestSession(String deviceId, String app, Instant from, Instant to) {
        return jdbcTemplate.query(
                FIND_LONGEST_SESSION,
                SESSION_ROW_MAPPER,
                deviceId,
                app,
                Timestamp.from(from),
                Timestamp.from(to)
        ).stream().findFirst();
    }

    public List<UsageRollup> findUsageRollups(
            String deviceId,
            String app,
            RollupGranularity granularity,
            Instant from,
            Instant to
    ) {
        return jdbcTemplate.query(
                FIND_USAGE_ROLLUPS,
                (resultSet, rowNumber) -> new UsageRollup(
                        resultSet.getString("device_id"),
                        resultSet.getString("app"),
                        RollupGranularity.valueOf(
                                resultSet.getString("granularity")
                        ),
                        resultSet.getString("bucket_timezone"),
                        resultSet.getTimestamp("bucket_start").toInstant(),
                        resultSet.getLong("usage_milliseconds"),
                        resultSet.getTimestamp("updated_at").toInstant()
                ),
                deviceId,
                app,
                granularity.name(),
                Timestamp.from(from),
                Timestamp.from(to)
        );
    }

    public List<AnomalyCount> findAnomalyCounts(
            String deviceId,
            String app,
            Instant from,
            Instant to
    ) {
        return jdbcTemplate.query(
                FIND_ANOMALY_COUNTS,
                (resultSet, rowNumber) -> new AnomalyCount(
                        resultSet.getString("anomaly_type"),
                        resultSet.getLong("anomaly_count")
                ),
                deviceId,
                app,
                Timestamp.from(from),
                Timestamp.from(to)
        );
    }

    public List<String> findDeviceIds() {
        return jdbcTemplate.queryForList(FIND_DEVICE_IDS, String.class);
    }

    public List<String> findApps(String deviceId) {
        if (deviceId == null || deviceId.isBlank()) {
            return jdbcTemplate.queryForList(FIND_APPS, String.class);
        }

        return jdbcTemplate.queryForList(FIND_APPS_FOR_DEVICE, String.class, deviceId);
    }

    // Total usage of one app in [from, to), from the hourly rollups.
    public long findUsageTotal(String deviceId, String app, Instant from, Instant to) {
        Long total = jdbcTemplate.queryForObject(
                FIND_USAGE_TOTAL, Long.class, deviceId, app, Timestamp.from(from), Timestamp.from(to));
        return total == null ? 0 : total;
    }

    public String findAppIcon(String app) {
        return jdbcTemplate.queryForList("SELECT icon_url FROM app_icons WHERE app = ? AND icon_url IS NOT NULL", String.class, app)
                .stream().findFirst().orElse(null);
    }

    public Map<String, String> findAppIcons() {
        Map<String, String> icons = new TreeMap<>();
        jdbcTemplate.query(FIND_APP_ICONS, resultSet -> {
            icons.put(resultSet.getString("app"), resultSet.getString("icon_url"));
        });
        return icons;
    }

    public List<TopApp> findTopApps(String deviceId, Instant from, Instant to, int limit) {
        return jdbcTemplate.query(
                FIND_TOP_APPS,
                (resultSet, rowNumber) -> new TopApp(
                        resultSet.getString("app"),
                        resultSet.getLong("usage_milliseconds"),
                        resultSet.getString("icon_url")
                ),
                deviceId,
                Timestamp.from(from),
                Timestamp.from(to),
                limit
        );
    }

    public Optional<String> findTopAppOnLatestDay(String deviceId) {
        return jdbcTemplate.queryForList(FIND_TOP_APP_ON_LATEST_DAY, String.class, deviceId)
                .stream()
                .findFirst();
    }

    public Optional<Instant> findEarliestBucketStart(String deviceId, String app) {
        Timestamp earliest = (app == null || app.isBlank())
                ? jdbcTemplate.queryForObject(
                        FIND_EARLIEST_BUCKET_START_FOR_DEVICE,
                        Timestamp.class,
                        deviceId
                )
                : jdbcTemplate.queryForObject(
                        FIND_EARLIEST_BUCKET_START_FOR_DEVICE_AND_APP,
                        Timestamp.class,
                        deviceId,
                        app
                );

        return Optional.ofNullable(earliest).map(Timestamp::toInstant);
    }

    public List<LocalDate> findAvailableDates(String deviceId, String app) {
        return (app == null || app.isBlank())
                ? jdbcTemplate.query(
                        FIND_AVAILABLE_DATES_FOR_DEVICE,
                        (resultSet, rowNumber) -> resultSet.getDate("usage_date").toLocalDate(),
                        deviceId
                )
                : jdbcTemplate.query(
                        FIND_AVAILABLE_DATES_FOR_DEVICE_AND_APP,
                        (resultSet, rowNumber) -> resultSet.getDate("usage_date").toLocalDate(),
                        deviceId,
                        app
                );
    }
}
