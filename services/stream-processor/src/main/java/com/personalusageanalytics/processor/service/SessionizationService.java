package com.personalusageanalytics.processor.service;

import java.time.Duration;
import java.util.List;
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
                    event.app(),
                    "DUPLICATE_OPEN",
                    activeOpenEventId
            );
        }
    }

    private void processClose(RawUsageEvent event) {
        List<ActiveSession> activeSessions =
                sessionizationRepository.removeActiveSessions(event.deviceId());

        if (activeSessions.isEmpty()) {
            sessionizationRepository.recordAnomaly(
                    event,
                    null,
                    "UNMATCHED_CLOSE",
                    null
            );
            return;
        }

        for (ActiveSession active : activeSessions) {
            processCloseForActiveSession(event, active);
        }
    }

    private void processCloseForActiveSession(
            RawUsageEvent event,
            ActiveSession active
    ) {
        long durationMilliseconds = Duration.between(
                active.openedAt(),
                event.occurredAt()
        ).toMillis();

        if (durationMilliseconds < 0) {
            sessionizationRepository.restoreActiveSession(active, event);

            sessionizationRepository.recordAnomaly(
                    event,
                    active.app(),
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
                    active.app(),
                    active.openedAt(),
                    event.occurredAt()
            );
        }
    }
}
