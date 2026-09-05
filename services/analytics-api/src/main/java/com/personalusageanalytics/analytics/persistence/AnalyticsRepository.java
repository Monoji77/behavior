package com.personalusageanalytics.analytics.persistence;

import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;
import java.util.List;
import java.time.Instant;


import com.personalusageanalytics.analytics.model.LatestSession;
import com.personalusageanalytics.analytics.model.RollupGranularity;
import com.personalusageanalytics.analytics.model.UsageRollup;
import com.personalusageanalytics.analytics.model.AnomalyCount;

import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbcTemplate;

    public AnalyticsRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<LatestSession> findLatestSession(String deviceId, String app) {
        return jdbcTemplate.query(
                FIND_LATEST_SESSION,
                (resultSet, rowNumber) -> {
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
                },
                deviceId,
                app
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
}