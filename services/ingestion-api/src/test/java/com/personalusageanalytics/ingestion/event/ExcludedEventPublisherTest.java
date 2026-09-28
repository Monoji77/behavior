package com.personalusageanalytics.ingestion.event;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.Instant;
import java.util.UUID;

import com.personalusageanalytics.ingestion.config.IngestionProperties;
import com.personalusageanalytics.ingestion.privacy.AppExclusions;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.core.KafkaTemplate;

class ExcludedEventPublisherTest {
    @SuppressWarnings("unchecked")
    @Test
    void acknowledgesExcludedEventsWithoutPublishingTheirPayload() {
        KafkaTemplate<String, UsageEventRequest> kafka = mock(KafkaTemplate.class);
        var publisher = new UsageEventPublisher(kafka,
                new IngestionProperties("test-token", new IngestionProperties.Topics("raw")));
        var event = new UsageEventRequest(UUID.randomUUID(), Instant.now(),
                UsageEventRequest.EventType.OPEN, "Private Example", "Shortcut", "Phone");
        try (var policy = mockStatic(AppExclusions.class)) {
            policy.when(() -> AppExclusions.isExcluded(event.app())).thenReturn(true);
            publisher.publish(event);
        }
        verifyNoInteractions(kafka);
    }
}
