package com.personalusageanalytics.processor.service;

import java.time.Duration;
import java.util.Optional;
import java.util.UUID;

import com.personalusageanalytics.processor.event.RawUsageEvent;
import com.personalusageanalytics.processor.persistence.RawEventRepository;
import com.personalusageanalytics.processor.persistence.SessionizationRepository;
import com.personalusageanalytics.processor.persistence.SessionizationRepository.ActiveSession;
import com.personalusageanalytics.processor.rollup.UsageRollupService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;



@Service
public class SessionizationService {

    private final RawEventRepository rawEventRepository;
    private final SessionizationRepository sessionizationRepository;
    private final UsageRollupService usageRollupService;

    public SessionizationService(
            RawEventRepository rawEventRepository,
            SessionizationRepository sessionizationRepository,
            UsageRollupService usageRollupService
    ) {
        this.rawEventRepository = rawEventRepository;
        this.sessionizationRepository = sessionizationRepository;
        this.usageRollupService = usageRollupService;
    }

    @Transactional
    public void process(RawUsageEvent event, int kafkaPartition, long kafkaOffset) {
        boolean isNewRawEvent = rawEventRepository.insert(
                event,
                kafkaPartition,
                kafkaOffset
        );

        if (!isNewRawEvent) {
            return;
        }

        switch (event.eventType()) {
            case OPEN -> processOpen(event);
            case CLOSE -> processClose(event);
        }
    }

    private void processOpen(RawUsageEvent event) {
        boolean created = sessionizationRepository.createActiveSession(event);

        if (!created) {
            UUID activeOpenEventId = sessionizationRepository.incrementDuplicateOpen(event);

            sessionizationRepository.recordAnomaly(
                    event,
                    "DUPLICATE_OPEN",
                    activeOpenEventId
            );
        }
    }

    private void processClose(RawUsageEvent event) {
        Optional<ActiveSession> activeSession =
                sessionizationRepository.removeActiveSession(event);

        if (activeSession.isEmpty()) {
            sessionizationRepository.recordAnomaly(
                    event,
                    "UNMATCHED_CLOSE",
                    null
            );
            return;
        }

        ActiveSession active = activeSession.get();

        long durationMilliseconds = Duration.between(
                active.openedAt(),
                event.occurredAt()
        ).toMillis();

        if (durationMilliseconds < 0) {
            sessionizationRepository.restoreActiveSession(active, event);

            sessionizationRepository.recordAnomaly(
                    event,
                    "OUT_OF_ORDER_CLOSE",
                    active.openEventId()
            );
            return;
        }

        boolean completed = sessionizationRepository.createCompletedSession(
                active,
                event,
                durationMilliseconds
        );

        if (completed) {
            usageRollupService.recordCompletedSession(
                    event.deviceId(),
                    event.app(),
                    active.openedAt(),
                    event.occurredAt()
            );
        }
    }
}