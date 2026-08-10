package com.personalusageanalytics.processor.persistence;

import java.sql.Timestamp;
import java.time.Instant;

import com.personalusageanalytics.processor.event.RawUsageEvent;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class RawEventRepository {

    private static final String INSERT_RAW_EVENT = """
            INSERT INTO raw_app_events (
                event_id,
                occurred_at,
                received_at,
                event_type,
                app,
                source,
                device_id,
                kafka_partition,
                kafka_offset
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (event_id, occurred_at) DO NOTHING
            """;

    private final JdbcTemplate jdbcTemplate;

    public RawEventRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public void insert(RawUsageEvent event, int kafkaPartition, long kafkaOffset) {
        jdbcTemplate.update(
                INSERT_RAW_EVENT,
                event.eventId(),
                Timestamp.from(event.occurredAt()),
                Timestamp.from(Instant.now()),
                event.eventType().name(),
                event.app(),
                event.source(),
                event.deviceId(),
                kafkaPartition,
                kafkaOffset
        );
    }
}