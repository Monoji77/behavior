package com.personalusageanalytics.processor.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

import com.personalusageanalytics.processor.event.RawUsageEvent;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class SessionizationRepository {

    private static final String INSERT_ACTIVE_SESSION = """
            INSERT INTO active_app_sessions (
                device_id,
                app,
                open_event_id,
                opened_at,
                source
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT DO NOTHING
            """;

    private static final String INCREMENT_DUPLICATE_OPEN = """
            UPDATE active_app_sessions
            SET duplicate_open_count = duplicate_open_count + 1
            WHERE device_id = ?
              AND app = ?
            RETURNING open_event_id
            """;

    private static final String DELETE_ACTIVE_SESSION = """
            DELETE FROM active_app_sessions
            WHERE device_id = ?
              AND app = ?
            RETURNING open_event_id, opened_at, source, duplicate_open_count
            """;

    private static final String RESTORE_ACTIVE_SESSION = """
        INSERT INTO active_app_sessions (
            device_id,
            app,
            open_event_id,
            opened_at,
            source,
            duplicate_open_count
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
        """;

    private static final String INSERT_COMPLETED_SESSION = """
            INSERT INTO app_usage_sessions (
                session_id,
                device_id,
                app,
                source,
                open_event_id,
                close_event_id,
                opened_at,
                closed_at,
                duration_milliseconds,
                status,
                duplicate_open_count
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?)
            ON CONFLICT DO NOTHING
            """;

    private static final String INSERT_ANOMALY = """
            INSERT INTO app_usage_event_anomalies (
                event_id,
                occurred_at,
                device_id,
                app,
                event_type,
                anomaly_type,
                active_open_event_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (event_id) DO NOTHING
            """;
    
    private static final String DELETE_EXPIRED_ACTIVE_SESSIONS = """
        DELETE FROM active_app_sessions
        WHERE opened_at <= ?
        RETURNING device_id, app, open_event_id, opened_at, source, duplicate_open_count
        """;

    private static final String INSERT_ABANDONED_SESSION = """
            INSERT INTO app_usage_sessions (
                session_id,
                device_id,
                app,
                source,
                open_event_id,
                opened_at,
                status,
                duplicate_open_count
            ) VALUES (?, ?, ?, ?, ?, ?, 'ABANDONED', ?)
            ON CONFLICT (open_event_id) DO NOTHING
            """;

    private final JdbcTemplate jdbcTemplate;

    public SessionizationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public boolean createActiveSession(RawUsageEvent event) {
        return jdbcTemplate.update(
                INSERT_ACTIVE_SESSION,
                event.deviceId(),
                event.app(),
                event.eventId(),
                Timestamp.from(event.occurredAt()),
                event.source()
        ) == 1;
    }

    public UUID incrementDuplicateOpen(RawUsageEvent event) {
        return jdbcTemplate.queryForObject(
                INCREMENT_DUPLICATE_OPEN,
                UUID.class,
                event.deviceId(),
                event.app()
        );
    }

    public Optional<ActiveSession> removeActiveSession(RawUsageEvent event) {
        return jdbcTemplate.query(
                DELETE_ACTIVE_SESSION,
                (resultSet, rowNumber) -> new ActiveSession(
                        resultSet.getObject("open_event_id", UUID.class),
                        resultSet.getTimestamp("opened_at").toInstant(),
                        resultSet.getString("source"),
                        resultSet.getInt("duplicate_open_count")
                ),
                event.deviceId(),
                event.app()
        ).stream().findFirst();
    }


    public boolean createCompletedSession(
                ActiveSession activeSession,
                RawUsageEvent closeEvent,
                long durationMilliseconds
        ) {
        return jdbcTemplate.update(
                INSERT_COMPLETED_SESSION,
                UUID.randomUUID(),
                closeEvent.deviceId(),
                closeEvent.app(),
                activeSession.source(),
                activeSession.openEventId(),
                closeEvent.eventId(),
                Timestamp.from(activeSession.openedAt()),
                Timestamp.from(closeEvent.occurredAt()),
                durationMilliseconds,
                activeSession.duplicateOpenCount()
        ) == 1;
        }

    public void recordAnomaly(
            RawUsageEvent event,
            String anomalyType,
            UUID activeOpenEventId
    ) {
        jdbcTemplate.update(
                INSERT_ANOMALY,
                event.eventId(),
                Timestamp.from(event.occurredAt()),
                event.deviceId(),
                event.app(),
                event.eventType().name(),
                anomalyType,
                activeOpenEventId
        );
    }

    public void restoreActiveSession(
            ActiveSession activeSession,
            RawUsageEvent event
    ) {
        jdbcTemplate.update(
                RESTORE_ACTIVE_SESSION,
                event.deviceId(),
                event.app(),
                activeSession.openEventId(),
                Timestamp.from(activeSession.openedAt()),
                activeSession.source(),
                activeSession.duplicateOpenCount()
        );
    }

    public List<ExpiredSession> removeExpiredActiveSessions(Instant cutoff) {
        return jdbcTemplate.query(
                DELETE_EXPIRED_ACTIVE_SESSIONS,
                (resultSet, rowNumber) -> new ExpiredSession(
                        resultSet.getString("device_id"),
                        resultSet.getString("app"),
                        resultSet.getObject("open_event_id", UUID.class),
                        resultSet.getTimestamp("opened_at").toInstant(),
                        resultSet.getString("source"),
                        resultSet.getInt("duplicate_open_count")
                ),
                Timestamp.from(cutoff)
        );
    }

    public void createAbandonedSession(ExpiredSession expiredSession) {
        jdbcTemplate.update(
                INSERT_ABANDONED_SESSION,
                UUID.randomUUID(),
                expiredSession.deviceId(),
                expiredSession.app(),
                expiredSession.source(),
                expiredSession.openEventId(),
                Timestamp.from(expiredSession.openedAt()),
                expiredSession.duplicateOpenCount()
        );
    }
    public record ActiveSession(
            UUID openEventId,
            Instant openedAt,
            String source,
            int duplicateOpenCount
    ) {}
    public record ExpiredSession(
            String deviceId,
            String app,
            UUID openEventId,
            Instant openedAt,
            String source,
            int duplicateOpenCount
    ) {}

}