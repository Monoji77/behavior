package com.personalusageanalytics.processor.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

// The live-activity trigger (005-create-pipeline-notify.sql) against a real TimescaleDB.
@Testcontainers
class PipelineNotifyIntegrationTest {

    private static final Path REPOSITORY_ROOT = findRepositoryRoot();

    @Container
    private static final PostgreSQLContainer<?> TIMESCALEDB =
            new PostgreSQLContainer<>(
                    DockerImageName.parse("timescale/timescaledb:2.28.3-pg17").asCompatibleSubstituteFor("postgres"))
                    .withDatabaseName("usage_analytics")
                    .withUsername("usage_app")
                    .withPassword("test-password")
                    .withCopyFileToContainer(init("001-create-raw-events.sql"), "/docker-entrypoint-initdb.d/001-create-raw-events.sql")
                    .withCopyFileToContainer(init("002-create-sessionization.sql"), "/docker-entrypoint-initdb.d/002-create-sessionization.sql")
                    .withCopyFileToContainer(init("005-create-pipeline-notify.sql"), "/docker-entrypoint-initdb.d/005-create-pipeline-notify.sql");

    private static MountableFile init(String name) {
        return MountableFile.forHostPath(REPOSITORY_ROOT.resolve("infrastructure/postgres/init/" + name));
    }

    @Test
    void announcesNewOpensAndCompletedSessionsButNotDuplicatesOrCloses() throws Exception {
        try (Connection listener = connect(); Connection writer = connect()) {
            try (Statement listen = listener.createStatement()) {
                listen.execute("LISTEN pipeline_events");
            }
            try (Statement write = writer.createStatement()) {
                String open = """
                        INSERT INTO raw_app_events (event_id, occurred_at, received_at, event_type, app, source, device_id)
                        VALUES ('11111111-1111-1111-1111-111111111111', '2026-09-24T01:00:00Z', NOW(), 'OPEN', 'Telegram', 'iPhone Shortcut', 'iPhone 16 Pro')
                        ON CONFLICT (event_id, occurred_at) DO NOTHING""";
                write.execute(open);
                write.execute(open); // replay of the same event: skipped, so no second notification
                write.execute("""
                        INSERT INTO raw_app_events (event_id, occurred_at, received_at, event_type, app, source, device_id)
                        VALUES ('22222222-2222-2222-2222-222222222222', '2026-09-24T01:02:00Z', NOW(), 'CLOSE', NULL, 'iPhone Shortcut', 'iPhone 16 Pro')""");
                write.execute("""
                        INSERT INTO app_usage_sessions (session_id, device_id, app, source, open_event_id, close_event_id,
                            opened_at, closed_at, duration_milliseconds, status, duplicate_open_count)
                        VALUES ('33333333-3333-3333-3333-333333333333', 'iPhone 16 Pro', 'Telegram', 'iPhone Shortcut',
                            '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222',
                            '2026-09-24T01:00:00Z', '2026-09-24T01:02:00Z', 120000, 'COMPLETED', 0)""");
            }

            List<String> payloads = new ArrayList<>();
            PGConnection pg = listener.unwrap(PGConnection.class);
            for (int attempt = 0; attempt < 10 && payloads.size() < 2; attempt++) {
                PGNotification[] notifications = pg.getNotifications(500);
                if (notifications != null) for (PGNotification n : notifications) payloads.add(n.getParameter());
            }

            assertEquals(2, payloads.size(), payloads.toString());
            assertTrue(payloads.get(0).contains("\"kind\" : \"OPEN\"") && payloads.get(0).contains("\"app\" : \"Telegram\""), payloads.get(0));
            assertTrue(payloads.get(1).contains("\"kind\" : \"CLOSE\"") && payloads.get(1).contains("\"durationMilliseconds\" : 120000"), payloads.get(1));
        }
    }

    private static Connection connect() throws Exception {
        return DriverManager.getConnection(TIMESCALEDB.getJdbcUrl(), TIMESCALEDB.getUsername(), TIMESCALEDB.getPassword());
    }

    private static Path findRepositoryRoot() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("infrastructure/postgres/init/001-create-raw-events.sql"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Could not locate repository root");
    }
}
