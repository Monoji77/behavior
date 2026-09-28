package com.personalusageanalytics.analytics.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

@Testcontainers
class CurrentActivityIntegrationTest {
    private static final Path ROOT = root();
    @Container
    private static final PostgreSQLContainer<?> DB = database();
    private JdbcTemplate jdbc;
    private AnalyticsRepository repository;

    private static PostgreSQLContainer<?> database() {
        var db = new PostgreSQLContainer<>(DockerImageName.parse("timescale/timescaledb:2.28.3-pg17")
                .asCompatibleSubstituteFor("postgres"))
                .withDatabaseName("usage_analytics").withUsername("usage_app").withPassword("test-password");
        for (String file : List.of("001-create-raw-events.sql", "002-create-sessionization.sql", "003-create-usage-rollups.sql", "004-create-app-icons.sql", "006-excluded-app-privacy.sql")) {
            db.withCopyFileToContainer(MountableFile.forHostPath(ROOT.resolve("infrastructure/postgres/init/" + file)), "/docker-entrypoint-initdb.d/" + file);
        }
        return db;
    }

    @BeforeEach
    void setup() {
        jdbc = new JdbcTemplate(new DriverManagerDataSource(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword()));
        jdbc.execute("TRUNCATE active_app_sessions, app_usage_sessions, app_icons");
        repository = new AnalyticsRepository(jdbc);
    }

    @Test
    void prefersAnOlderActiveSessionOverNewerCompletedUsage() {
        active("Phone", "Telegram", "2026-09-27T23:00:00Z");
        closed("Phone", "Netflix", "2026-09-28T08:00:00Z", "2026-09-28T08:05:00Z");
        jdbc.update("INSERT INTO app_icons (app, icon_url, source) VALUES ('Telegram', 'telegram.png', 'manual')");
        var activity = repository.findCurrentActivity().orElseThrow();
        assertEquals("Telegram", activity.app());
        assertEquals("ACTIVE", activity.status());
        assertEquals(Instant.parse("2026-09-27T23:00:00Z"), activity.openedAt());
        assertEquals("telegram.png", activity.iconUrl());
        assertNull(activity.closedAt());
        assertNull(activity.durationMilliseconds());
    }

    @Test
    void selectsTheNewestVisibleActiveAppAcrossDevices() {
        active("Phone", "Telegram", "2026-09-28T08:00:00Z");
        active("Phone", "Netflix", "2026-09-28T08:01:00Z");
        active("Phone", "postman-test", "2026-09-28T08:05:00Z");
        active("Other phone", "Calendar", "2026-09-28T07:06:00Z");
        assertEquals("Netflix", repository.findCurrentActivity().orElseThrow().app());
        active("Other phone", "Discord", "2026-09-28T08:10:00Z");
        assertEquals("Other phone", repository.findCurrentActivity().orElseThrow().deviceId());

    }

    @Test
    void ordersCompletedSessionsByClosingTimeAndExcludesAbandonedAndDiagnosticRows() {
        closed("Phone", "Netflix", "2026-09-28T08:00:00Z", "2026-09-28T08:30:00Z");
        closed("Phone", "Telegram", "2026-09-28T08:10:00Z", "2026-09-28T08:15:00Z");
        closed("Phone", "postman-test", "2026-09-28T09:00:00Z", "2026-09-28T09:05:00Z");
        jdbc.update("INSERT INTO app_usage_sessions (session_id, device_id, app, source, open_event_id, opened_at, status) VALUES (gen_random_uuid(), 'Phone', 'Calendar', 'Shortcut', gen_random_uuid(), '2026-09-28T10:00:00Z', 'ABANDONED')");
        var activity = repository.findCurrentActivity().orElseThrow();
        assertEquals("Netflix", activity.app());
        assertEquals("COMPLETED", activity.status());
        assertEquals(Instant.parse("2026-09-28T08:30:00Z"), activity.closedAt());
        assertEquals(1_800_000L, activity.durationMilliseconds());

    }

    @Test
    void returnsNoActivityWithoutVisibleSessionsAndPreservesZeroDurations() {
        assertTrue(repository.findCurrentActivity().isEmpty());
        active("diagnostic-phone", "Telegram", "2026-09-28T08:00:00Z");
        assertTrue(repository.findCurrentActivity().isEmpty());
        closed("Phone", "Netflix", "2026-09-28T08:00:00Z", "2026-09-28T08:00:00Z");
        assertEquals(0L, repository.findCurrentActivity().orElseThrow().durationMilliseconds());
    }

    private void active(String device, String app, String opened) {
        jdbc.update("INSERT INTO active_app_sessions (device_id, app, open_event_id, opened_at, source) VALUES (?, ?, gen_random_uuid(), ?, 'Shortcut')", device, app, Timestamp.from(Instant.parse(opened)));
    }

    private void closed(String device, String app, String opened, String closed) {
        Instant start = Instant.parse(opened), end = Instant.parse(closed);
        jdbc.update("INSERT INTO app_usage_sessions (session_id, device_id, app, source, open_event_id, close_event_id, opened_at, closed_at, duration_milliseconds, status) VALUES (gen_random_uuid(), ?, ?, 'Shortcut', gen_random_uuid(), gen_random_uuid(), ?, ?, ?, 'COMPLETED')", device, app, Timestamp.from(start), Timestamp.from(end), end.toEpochMilli() - start.toEpochMilli());
    }

    private static Path root() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("infrastructure/postgres/init/001-create-raw-events.sql"))) return current;
            current = current.getParent();
        }
        throw new IllegalStateException("Repository root unavailable");
    }
}
