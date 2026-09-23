package com.personalusageanalytics.processor.consumer;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.mockito.Mockito.mock;

import java.util.Map;

import com.personalusageanalytics.processor.service.SessionizationService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.AnnotationConfigApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.MessageListenerContainer;

class RawEventListenerTopicsTest {

    @Test
    void subscribesToEveryConfiguredRawEventTopic() {
        try (var context = new AnnotationConfigApplicationContext(ListenerConfig.class)) {
            MessageListenerContainer container = context.getBean(KafkaListenerEndpointRegistry.class)
                    .getListenerContainers().iterator().next();

            assertArrayEquals(
                    new String[] {"app-usage-events.raw.v1", "staging.app-usage-events.raw.v1"},
                    container.getContainerProperties().getTopics()
            );
        }
    }

    @EnableKafka
    @Configuration
    static class ListenerConfig {
        @Bean
        String[] rawEventTopics() {
            return new String[] {"app-usage-events.raw.v1", "staging.app-usage-events.raw.v1"};
        }

        @Bean
        RawEventListener rawEventListener() {
            return new RawEventListener(mock(SessionizationService.class));
        }

        @Bean
        ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory() {
            var factory = new ConcurrentKafkaListenerContainerFactory<String, Object>();
            factory.setConsumerFactory(new DefaultKafkaConsumerFactory<>(Map.of()));
            factory.setAutoStartup(false);
            return factory;
        }
    }
}
