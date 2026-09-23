package com.personalusageanalytics.processor.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import com.personalusageanalytics.processor.icon.AppIconRepository;
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
class AppIconRepositoryIntegrationTest {

    private static final Path REPOSITORY_ROOT = findRepositoryRoot();

    @Container
    private static final PostgreSQLContainer<?> TIMESCALEDB =
            new PostgreSQLContainer<>(
                    DockerImageName
                            .parse("timescale/timescaledb:2.28.3-pg17")
                            .asCompatibleSubstituteFor("postgres")
            )
                    .withDatabaseName("usage_analytics")
                    .withUsername("usage_app")
                    .withPassword("test-password")
                    .withCopyFileToContainer(
                            MountableFile.forHostPath(REPOSITORY_ROOT.resolve(
                                    "infrastructure/postgres/init/003-create-usage-rollups.sql")),
                            "/docker-entrypoint-initdb.d/003-create-usage-rollups.sql")
                    .withCopyFileToContainer(
                            MountableFile.forHostPath(REPOSITORY_ROOT.resolve(
                                    "infrastructure/postgres/init/004-create-app-icons.sql")),
                            "/docker-entrypoint-initdb.d/004-create-app-icons.sql");

    private JdbcTemplate jdbcTemplate;
    private AppIconRepository repository;

    @BeforeEach
    void setUp() {
        jdbcTemplate = new JdbcTemplate(new DriverManagerDataSource(
                TIMESCALEDB.getJdbcUrl(), TIMESCALEDB.getUsername(), TIMESCALEDB.getPassword()));
        jdbcTemplate.update("TRUNCATE app_usage_rollups, app_icons");
        repository = new AppIconRepository(jdbcTemplate);
        for (String app : List.of("Anywheel", "Calendar", "Citibank SG", "Settings", "Spotify")) {
            jdbcTemplate.update("""
                    INSERT INTO app_usage_rollups (device_id, app, granularity, bucket_timezone, bucket_start, usage_milliseconds)
                    VALUES ('iPhone 16 Pro', ?, 'HOUR', 'UTC', '2026-09-23T00:00:00Z', 60000)
                    """, app);
        }
        jdbcTemplate.update("INSERT INTO app_icons (app, icon_url, source) VALUES ('Spotify', 'spotify.png', 'itunes')");
        jdbcTemplate.update("INSERT INTO app_icons (app, icon_url, source, looked_up_at) VALUES ('Citibank SG', NULL, 'none', NOW() - INTERVAL '8 days')");
        jdbcTemplate.update("INSERT INTO app_icons (app, icon_url, source) VALUES ('Calendar', NULL, 'none')");
        jdbcTemplate.update("INSERT INTO app_icons (app, icon_url, source) VALUES ('Settings', 'settings.png', 'manual')");
    }

    @Test
    void findsAppsWithoutIconsAndStaleMissesButNeverManualOnes() {
        assertEquals(List.of("Anywheel", "Citibank SG"),
                repository.findAppsNeedingLookup(Instant.now().minusSeconds(7 * 24 * 3600), 10));
        assertEquals(List.of("Anywheel"),
                repository.findAppsNeedingLookup(Instant.now().minusSeconds(7 * 24 * 3600), 1));
    }

    @Test
    void savesLookupsWithoutOverwritingManualIcons() {
        repository.saveLookup("Anywheel", "anywheel.png");
        repository.saveLookup("Citibank SG", null);
        repository.saveLookup("Settings", "wrong.png");

        assertEquals(List.of(
                        "Anywheel|anywheel.png|itunes",
                        "Calendar|null|none",
                        "Citibank SG|null|none",
                        "Settings|settings.png|manual",
                        "Spotify|spotify.png|itunes"),
                jdbcTemplate.queryForList(
                        "SELECT app || '|' || coalesce(icon_url, 'null') || '|' || source FROM app_icons ORDER BY app",
                        String.class));
        assertEquals(List.of(), repository.findAppsNeedingLookup(Instant.now().minusSeconds(7 * 24 * 3600), 10));
    }

    private static Path findRepositoryRoot() {
        Path current = Path.of("").toAbsolutePath();

        while (current != null) {
            if (Files.exists(current.resolve(
                    "infrastructure/postgres/init/001-create-raw-events.sql"
            ))) {
                return current;
            }

            current = current.getParent();
        }

        throw new IllegalStateException("Could not locate repository root");
    }
}
