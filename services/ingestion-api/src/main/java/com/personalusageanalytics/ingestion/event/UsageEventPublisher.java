package com.personalusageanalytics.ingestion.event;

import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import com.personalusageanalytics.ingestion.config.IngestionProperties;

import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;

import org.apache.kafka.common.KafkaException;

@Service
public class UsageEventPublisher {

    private static final long PUBLISH_TIMEOUT_SECONDS = 2;

    private final KafkaTemplate<String, UsageEventRequest> kafkaTemplate;
    private final IngestionProperties ingestionProperties;

    public UsageEventPublisher(
            KafkaTemplate<String, UsageEventRequest> kafkaTemplate,
            IngestionProperties ingestionProperties
    ) {
        this.kafkaTemplate = kafkaTemplate;
        this.ingestionProperties = ingestionProperties;
    }

    public void publish(UsageEventRequest event) {
        UsageEventRequest normalizedEvent = event.normalizedToMilliseconds();

        try {
            kafkaTemplate.send(
                    ingestionProperties.topics().rawEvents(),
                    normalizedEvent.deviceId(),
                    normalizedEvent
            ).get(PUBLISH_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        } catch (KafkaException exception) {
            throw new KafkaPublishException("Unable to create Kafka producer", exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new KafkaPublishException("Interrupted while publishing usage event", exception);
        } catch (ExecutionException | TimeoutException exception) {
            throw new KafkaPublishException("Unable to publish usage event", exception);
        }
    }
}