package com.personalusageanalytics.processor.integration;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.time.Duration;


import com.personalusageanalytics.processor.config.ProcessorProperties;
import com.personalusageanalytics.processor.event.RawUsageEvent;
import com.personalusageanalytics.processor.persistence.RawEventRepository;
import com.personalusageanalytics.processor.persistence.SessionizationRepository;
import com.personalusageanalytics.processor.rollup.UsageBucketAllocator;
import com.personalusageanalytics.processor.rollup.UsageRollupRepository;
import com.personalusageanalytics.processor.rollup.UsageRollupService;
import com.personalusageanalytics.processor.service.SessionizationService;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.MountableFile;

@Testcontainers
class SessionizationPersistenceIntegrationTest {

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
                                    "infrastructure/postgres/init/001-create-raw-events.sql"
                            )),
                            "/docker-entrypoint-initdb.d/001-create-raw-events.sql"
                    )
                    .withCopyFileToContainer(
                            MountableFile.forHostPath(REPOSITORY_ROOT.resolve(
                                    "infrastructure/postgres/init/002-create-sessionization.sql"
                            )),
                            "/docker-entrypoint-initdb.d/002-create-sessionization.sql"
                    )
                    .withCopyFileToContainer(
                                MountableFile.forHostPath(REPOSITORY_ROOT.resolve(
                                        "infrastructure/postgres/init/003-create-usage-rollups.sql"
                                )),
                                "/docker-entrypoint-initdb.d/003-create-usage-rollups.sql"
                        );

    private JdbcTemplate jdbcTemplate;
    private TransactionTemplate transactionTemplate;
    private SessionizationService sessionizationService;

    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                TIMESCALEDB.getJdbcUrl(),
                TIMESCALEDB.getUsername(),
                TIMESCALEDB.getPassword()
        );

        jdbcTemplate = new JdbcTemplate(dataSource);
        transactionTemplate = new TransactionTemplate(
                new DataSourceTransactionManager(dataSource)
        );

        ProcessorProperties properties = new ProcessorProperties(
                new ProcessorProperties.Topics(
                        "app-usage-events.raw.v1",
                        "app-usage-events.dlq.v1"
                ),
                new ProcessorProperties.Sessionization(
                        Duration.ofHours(6),
                        Duration.ofMinutes(1)
                ),
                new ProcessorProperties.Rollups("Asia/Singapore")
        );

        UsageRollupService usageRollupService = new UsageRollupService(
                new UsageBucketAllocator(),
                new UsageRollupRepository(jdbcTemplate),
                properties
        );

        sessionizationService = new SessionizationService(
                new RawEventRepository(jdbcTemplate),
                new SessionizationRepository(jdbcTemplate),
                usageRollupService
        );

        jdbcTemplate.execute("""
                TRUNCATE TABLE
                    app_usage_rollups,
                    app_usage_event_anomalies,
                    app_usage_sessions,
                    active_app_sessions,
                    raw_app_events
                """);
    }

    @Test
    void persistsSessionAndAnomaliesAgainstTimescaleDb() {
        Instant openedAt = Instant.parse("2026-08-31T10:00:00Z");

        RawUsageEvent open = event(
                openedAt,
                RawUsageEvent.EventType.OPEN
        );
        RawUsageEvent duplicateOpen = event(
                openedAt.plusMillis(500),
                RawUsageEvent.EventType.OPEN
        );
        RawUsageEvent close = event(
                openedAt.plusMillis(1_649),
                RawUsageEvent.EventType.CLOSE
        );
        RawUsageEvent unmatchedClose = event(
                openedAt.plusMillis(2_000),
                RawUsageEvent.EventType.CLOSE
        );

        process(open, 0L);
        process(duplicateOpen, 1L);
        process(close, 2L);
        process(unmatchedClose, 3L);

        assertEquals(
                4,
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM raw_app_events",
                        Integer.class
                )
        );

        assertEquals(
                1,
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM app_usage_sessions WHERE status = 'COMPLETED'",
                        Integer.class
                )
        );

        assertEquals(
                1_649L,
                jdbcTemplate.queryForObject(
                        "SELECT duration_milliseconds FROM app_usage_sessions",
                        Long.class
                )
        );

        assertEquals(
                1,
                jdbcTemplate.queryForObject(
                        "SELECT duplicate_open_count FROM app_usage_sessions",
                        Integer.class
                )
        );

        assertEquals(
                List.of("DUPLICATE_OPEN", "UNMATCHED_CLOSE"),
                jdbcTemplate.queryForList(
                        "SELECT anomaly_type FROM app_usage_event_anomalies ORDER BY occurred_at",
                        String.class
                )
        );

        assertEquals(
                0,
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM active_app_sessions",
                        Integer.class
                )
        );

        assertEquals(
                3,
                jdbcTemplate.queryForObject(
                        "SELECT COUNT(*) FROM app_usage_rollups",
                        Integer.class
                )
        );

        assertEquals(
                1_649L,
                jdbcTemplate.queryForObject(
                        "SELECT usage_milliseconds FROM app_usage_rollups WHERE granularity = 'MINUTE'",
                        Long.class
                )
        );

        assertEquals(
                1_649L,
                jdbcTemplate.queryForObject(
                        "SELECT usage_milliseconds FROM app_usage_rollups WHERE granularity = 'HOUR'",
                        Long.class
                )
        );

        assertEquals(
                1_649L,
                jdbcTemplate.queryForObject(
                        "SELECT usage_milliseconds FROM app_usage_rollups WHERE granularity = 'DAY'",
                        Long.class
                )
        );
    }

    private void process(RawUsageEvent event, long kafkaOffset) {
        transactionTemplate.executeWithoutResult(
                status -> sessionizationService.process(event, 0, kafkaOffset)
        );
    }

    private RawUsageEvent event(
            Instant occurredAt,
            RawUsageEvent.EventType eventType
    ) {
        return new RawUsageEvent(
                UUID.randomUUID(),
                occurredAt,
                eventType,
                "instagram",
                "integration-test",
                "iphone-test"
        );
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