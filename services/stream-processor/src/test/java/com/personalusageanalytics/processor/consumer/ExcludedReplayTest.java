package com.personalusageanalytics.processor.consumer;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.Instant;
import java.util.UUID;

import com.personalusageanalytics.processor.event.RawUsageEvent;
import com.personalusageanalytics.processor.privacy.AppExclusions;
import com.personalusageanalytics.processor.service.SessionizationService;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.junit.jupiter.api.Test;

class ExcludedReplayTest {
    @Test
    void skipsExcludedReplaysEvenWithInvalidKeysWithoutThrowingToTheDeadLetterQueue() {
        var sessions = mock(SessionizationService.class);
        var listener = new RawEventListener(sessions);
        var event = new RawUsageEvent(UUID.randomUUID(), Instant.now(),
                RawUsageEvent.EventType.OPEN, "Private Example", "Shortcut", "Phone");
        try (var policy = mockStatic(AppExclusions.class)) {
            policy.when(() -> AppExclusions.isExcluded(event.app())).thenReturn(true);
            listener.persist(new ConsumerRecord<>("raw", 0, 1, "wrong-key", event));
        }
        verifyNoInteractions(sessions);
    }

    @Test
    void retainsUnnamedCloseEventsForVisibleSessions() {
        var sessions = mock(SessionizationService.class);
        var event = new RawUsageEvent(UUID.randomUUID(), Instant.now(),
                RawUsageEvent.EventType.CLOSE, null, "Shortcut", "Phone");
        new RawEventListener(sessions).persist(new ConsumerRecord<>("raw", 0, 2, "Phone", event));
        verify(sessions).process(event, 0, 2);
    }
}
