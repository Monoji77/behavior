package com.personalusageanalytics.processor.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.personalusageanalytics.processor.config.ProcessorProperties;
import com.personalusageanalytics.processor.persistence.SessionizationRepository;
import com.personalusageanalytics.processor.persistence.SessionizationRepository.ExpiredSession;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SessionAbandonmentSchedulerTest {

    @Mock
    private SessionizationRepository sessionizationRepository;

    @Test
    void convertsEveryExpiredActiveSessionToAbandoned() {
        ExpiredSession expiredSession = new ExpiredSession(
                "iphone-test",
                "instagram",
                UUID.randomUUID(),
                Instant.parse("2026-08-31T10:00:00Z"),
                "unit-test",
                1
        );

        when(sessionizationRepository.removeExpiredActiveSessions(any(Instant.class)))
                .thenReturn(List.of(expiredSession));

        scheduler().abandonExpiredSessions();

        verify(sessionizationRepository)
                .removeExpiredActiveSessions(any(Instant.class));
        verify(sessionizationRepository)
                .createAbandonedSession(expiredSession);
    }

    @Test
    void doesNothingWhenThereAreNoExpiredSessions() {
        when(sessionizationRepository.removeExpiredActiveSessions(any(Instant.class)))
                .thenReturn(List.of());

        scheduler().abandonExpiredSessions();

        verify(sessionizationRepository, never())
                .createAbandonedSession(any());
    }

    private SessionAbandonmentScheduler scheduler() {
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

        return new SessionAbandonmentScheduler(
                sessionizationRepository,
                properties
        );
    }
}