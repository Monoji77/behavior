package com.personalusageanalytics.processor.consumer;

import com.personalusageanalytics.processor.event.RawUsageEvent;
import  com.personalusageanalytics.processor.service.SessionizationService;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Component
public class RawEventListener {

    private final SessionizationService sessionizationService;

    public RawEventListener(SessionizationService sessionizationService) {
        this.sessionizationService = sessionizationService;
    }

    @KafkaListener(topics = "${processor.topics.raw-events}")
    public void persist(ConsumerRecord<String, RawUsageEvent> record) {
        RawUsageEvent event = record.value();

        if (!event.deviceId().equals(record.key())) {
            throw new IllegalArgumentException("Kafka key does not match event deviceId");
        }

        sessionizationService.process(
                event,
                record.partition(),
                record.offset()
        );
    }
}