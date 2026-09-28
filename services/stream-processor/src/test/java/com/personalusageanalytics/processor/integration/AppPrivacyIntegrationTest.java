package com.personalusageanalytics.processor.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

import com.personalusageanalytics.processor.privacy.AppExclusions;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

@Testcontainers
class AppPrivacyIntegrationTest {
    private static final Path ROOT = findRoot();
    private static final List<String> TABLES = List.of("raw_app_events", "active_app_sessions",
            "app_usage_sessions", "app_usage_rollups", "app_usage_event_anomalies", "app_icons");

    @Container
    private static final PostgreSQLContainer<?> DB = database();

    private static PostgreSQLContainer<?> database() {
        var db = new PostgreSQLContainer<>(DockerImageName.parse("timescale/timescaledb:2.28.3-pg17")
                .asCompatibleSubstituteFor("postgres"))
                .withDatabaseName("usage_analytics").withUsername("usage_app").withPassword("test-password");
        for (String file : List.of("001-create-raw-events.sql", "002-create-sessionization.sql",
                "003-create-usage-rollups.sql", "004-create-app-icons.sql")) {
            db.withCopyFileToContainer(MountableFile.forHostPath(ROOT.resolve("infrastructure/postgres/init/" + file)),
                    "/docker-entrypoint-initdb.d/" + file);
        }
        return db;
    }

    @Test
    void purgesAllTablesAndBlocksReplaysAndUpdatesWithoutRemovingOtherApps() throws Exception {
        try (var connection = DriverManager.getConnection(DB.getJdbcUrl(), DB.getUsername(), DB.getPassword());
                Statement sql = connection.createStatement()) {
            sql.execute("CREATE TABLE excluded_app_fingerprints (fingerprint VARCHAR(64) PRIMARY KEY)");
            sql.execute("INSERT INTO excluded_app_fingerprints VALUES ('" + AppExclusions.fingerprint("Private Example") + "')");
            for (String table : TABLES) {
                sql.execute(insert(table, "Private Example"));
                sql.execute(insert(table, "Telegram"));
            }
            String migration = Files.readString(ROOT.resolve("infrastructure/postgres/init/006-excluded-app-privacy.sql"));
            sql.execute(migration);
            sql.execute(migration); // Safe to reapply on every GitOps sync.
            for (String table : TABLES) {
                try (var rows = sql.executeQuery("SELECT count(*) FROM " + table)) {
                    rows.next();
                    assertEquals(1, rows.getInt(1), table);
                }
                assertEquals(0, sql.executeUpdate(insert(table, "  pRiVaTe Example  ")), table);
                assertEquals(0, sql.executeUpdate("UPDATE " + table + " SET app='Private Example'"), table);
            }
            assertEquals(1, sql.executeUpdate("""
                    INSERT INTO raw_app_events (event_id, occurred_at, received_at, event_type, source, device_id)
                    VALUES (gen_random_uuid(), NOW(), NOW(), 'CLOSE', 'Shortcut', 'Phone')
                    """));
        }
    }

    private static String insert(String table, String app) {
        String values = switch (table) {
            case "raw_app_events" -> "(event_id, occurred_at, received_at, event_type, source, device_id, app) "
                    + "VALUES (gen_random_uuid(), NOW(), NOW(), 'OPEN', 'Shortcut', 'Phone', '%s')";
            case "active_app_sessions" -> "(device_id, open_event_id, opened_at, source, app) "
                    + "VALUES ('Phone', gen_random_uuid(), NOW(), 'Shortcut', '%s')";
            case "app_usage_sessions" -> "(session_id, device_id, source, open_event_id, opened_at, status, app) "
                    + "VALUES (gen_random_uuid(), 'Phone', 'Shortcut', gen_random_uuid(), NOW(), 'ABANDONED', '%s')";
            case "app_usage_rollups" -> "(device_id, granularity, bucket_timezone, bucket_start, usage_milliseconds, app) "
                    + "VALUES ('Phone', 'DAY', 'Asia/Singapore', NOW(), 1000, '%s')";
            case "app_usage_event_anomalies" -> "(event_id, occurred_at, device_id, event_type, anomaly_type, app) "
                    + "VALUES (gen_random_uuid(), NOW(), 'Phone', 'OPEN', 'DUPLICATE_OPEN', '%s')";
            case "app_icons" -> "(source, app) VALUES ('none', '%s')";
            default -> throw new IllegalArgumentException(table);
        };
        return "INSERT INTO " + table + " " + values.formatted(app);
    }

    private static Path findRoot() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.exists(current.resolve("infrastructure/postgres/init/001-create-raw-events.sql"))) return current;
            current = current.getParent();
        }
        throw new IllegalStateException("Repository root unavailable");
    }
}
