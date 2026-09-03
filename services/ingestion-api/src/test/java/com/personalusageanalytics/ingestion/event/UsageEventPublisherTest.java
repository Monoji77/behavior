package com.personalusageanalytics.ingestion.event;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import com.personalusageanalytics.ingestion.config.IngestionProperties;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;

class UsageEventPublisherTest {

    @SuppressWarnings("unchecked")
    @Test
    void publishesNormalizedEventToRawTopicUsingDeviceIdAsKafkaKey() {
        KafkaTemplate<String, UsageEventRequest> kafkaTemplate = mock(KafkaTemplate.class);

        IngestionProperties properties = new IngestionProperties(
                "test-token",
                new IngestionProperties.Topics("app-usage-events.raw.v1")
        );

        CompletableFuture<SendResult<String, UsageEventRequest>> completedSend =
                CompletableFuture.completedFuture(null);

        when(kafkaTemplate.send(
                eq("app-usage-events.raw.v1"),
                eq("iphone-test"),
                any(UsageEventRequest.class)
        )).thenReturn(completedSend);

        UsageEventPublisher publisher = new UsageEventPublisher(
                kafkaTemplate,
                properties
        );

        UsageEventRequest event = new UsageEventRequest(
                UUID.randomUUID(),
                Instant.parse("2026-09-03T03:44:39.070123456Z"),
                UsageEventRequest.EventType.OPEN,
                "instagram",
                "unit-test",
                "iphone-test"
        );

        publisher.publish(event);

        ArgumentCaptor<UsageEventRequest> eventCaptor =
                ArgumentCaptor.forClass(UsageEventRequest.class);

        verify(kafkaTemplate).send(
                eq("app-usage-events.raw.v1"),
                eq("iphone-test"),
                eventCaptor.capture()
        );

        assertEquals(
                Instant.parse("2026-09-03T03:44:39.070Z"),
                eventCaptor.getValue().occurredAt()
        );
        assertEquals(event.eventId(), eventCaptor.getValue().eventId());
    }
}