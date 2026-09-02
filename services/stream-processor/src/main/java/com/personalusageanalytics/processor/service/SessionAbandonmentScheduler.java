package com.personalusageanalytics.processor.service;

import java.time.Instant;

import com.personalusageanalytics.processor.config.ProcessorProperties;
import com.personalusageanalytics.processor.persistence.SessionizationRepository;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class SessionAbandonmentScheduler {

    private final SessionizationRepository sessionizationRepository;
    private final ProcessorProperties processorProperties;

    public SessionAbandonmentScheduler(
            SessionizationRepository sessionizationRepository,
            ProcessorProperties processorProperties
    ) {
        this.sessionizationRepository = sessionizationRepository;
        this.processorProperties = processorProperties;
    }

    @Scheduled(
            fixedDelayString = "${processor.sessionization.abandonment-check-interval}"
    )
    @Transactional
    public void abandonExpiredSessions() {
        Instant cutoff = Instant.now().minus(
                processorProperties.sessionization().abandonmentTimeout()
        );

        sessionizationRepository
                .removeExpiredActiveSessions(cutoff)
                .forEach(sessionizationRepository::createAbandonedSession);
    }
}