package com.personalusageanalytics.processor.service;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import com.personalusageanalytics.processor.event.RawUsageEvent;
import com.personalusageanalytics.processor.persistence.RawEventRepository;
import com.personalusageanalytics.processor.persistence.SessionizationRepository;
import com.personalusageanalytics.processor.persistence.SessionizationRepository.ActiveSession;
import com.personalusageanalytics.processor.rollup.UsageRollupService;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class SessionizationServiceTest {

    private static final Instant OPENED_AT =
            Instant.parse("2026-08-31T10:00:00Z");

    @Mock
    private RawEventRepository rawEventRepository;

    @Mock
    private SessionizationRepository sessionizationRepository;

    @InjectMocks
    private SessionizationService sessionizationService;

    @Mock
    private UsageRollupService usageRollupService;

    @Test
    void ignoresKafkaReplayAfterRawEventAlreadyExists() {
        RawUsageEvent event = event(OPENED_AT, RawUsageEvent.EventType.OPEN);

        when(rawEventRepository.insert(event, 0, 10L)).thenReturn(false);

        sessionizationService.process(event, 0, 10L);

        verify(rawEventRepository).insert(event, 0, 10L);
        verifyNoInteractions(sessionizationRepository);
    }

    @Test
    void createsActiveSessionForFirstOpen() {
        RawUsageEvent event = event(OPENED_AT, RawUsageEvent.EventType.OPEN);

        when(rawEventRepository.insert(event, 0, 10L)).thenReturn(true);
        when(sessionizationRepository.createActiveSession(event)).thenReturn(true);

        sessionizationService.process(event, 0, 10L);

        verify(sessionizationRepository).createActiveSession(event);
    }

    @Test
    void recordsDuplicateOpenWithoutReplacingActiveSession() {
        RawUsageEvent event = event(OPENED_AT, RawUsageEvent.EventType.OPEN);
        UUID activeOpenEventId = UUID.randomUUID();

        when(rawEventRepository.insert(event, 0, 10L)).thenReturn(true);
        when(sessionizationRepository.createActiveSession(event)).thenReturn(false);
        when(sessionizationRepository.incrementDuplicateOpen(event))
                .thenReturn(activeOpenEventId);

        sessionizationService.process(event, 0, 10L);

        verify(sessionizationRepository).incrementDuplicateOpen(event);
        verify(sessionizationRepository).recordAnomaly(
                event,
                "DUPLICATE_OPEN",
                activeOpenEventId
        );
    }

    @Test
    void createsCompletedSessionForMatchingClose() {
        RawUsageEvent closeEvent = event(
                OPENED_AT.plusMillis(1_649),
                RawUsageEvent.EventType.CLOSE
        );

        ActiveSession activeSession = new ActiveSession(
                UUID.randomUUID(),
                OPENED_AT,
                "unit-test",
                1
        );

        when(rawEventRepository.insert(closeEvent, 0, 10L)).thenReturn(true);
        when(sessionizationRepository.removeActiveSession(closeEvent))
                .thenReturn(Optional.of(activeSession));
        when(sessionizationRepository.createCompletedSession(
            activeSession,
            closeEvent,
            1_649L
        )).thenReturn(true);

        sessionizationService.process(closeEvent, 0, 10L);

        verify(sessionizationRepository).createCompletedSession(
                activeSession,
                closeEvent,
                1_649L
        );

        verify(usageRollupService).recordCompletedSession(
            closeEvent.deviceId(),
            closeEvent.app(),
            activeSession.openedAt(),
            closeEvent.occurredAt()
        );
    }

    @Test
    void recordsUnmatchedCloseWhenNoActiveSessionExists() {
        RawUsageEvent closeEvent = event(
                OPENED_AT,
                RawUsageEvent.EventType.CLOSE
        );

        when(rawEventRepository.insert(closeEvent, 0, 10L)).thenReturn(true);
        when(sessionizationRepository.removeActiveSession(closeEvent))
                .thenReturn(Optional.empty());

        sessionizationService.process(closeEvent, 0, 10L);

        verify(sessionizationRepository).recordAnomaly(
                closeEvent,
                "UNMATCHED_CLOSE",
                null
        );
    }

    @Test
    void restoresActiveSessionForOutOfOrderClose() {
        RawUsageEvent closeEvent = event(
                OPENED_AT.minusMillis(1),
                RawUsageEvent.EventType.CLOSE
        );

        ActiveSession activeSession = new ActiveSession(
                UUID.randomUUID(),
                OPENED_AT,
                "unit-test",
                0
        );

        when(rawEventRepository.insert(closeEvent, 0, 10L)).thenReturn(true);
        when(sessionizationRepository.removeActiveSession(closeEvent))
                .thenReturn(Optional.of(activeSession));

        sessionizationService.process(closeEvent, 0, 10L);

        verify(sessionizationRepository).restoreActiveSession(
                activeSession,
                closeEvent
        );
        verify(sessionizationRepository).recordAnomaly(
                closeEvent,
                "OUT_OF_ORDER_CLOSE",
                activeSession.openEventId()
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
                "unit-test",
                "iphone-test"
        );
    }
}