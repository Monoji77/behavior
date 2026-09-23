package com.personalusageanalytics.processor.config;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

class ProcessorPropertiesTest {

    @Test
    void bindsASingleRawEventTopic() {
        assertEquals(List.of("app-usage-events.raw.v1"), rawEvents("app-usage-events.raw.v1"));
    }

    @Test
    void bindsCommaSeparatedRawEventTopicsAsAList() {
        assertEquals(
                List.of("app-usage-events.raw.v1", "staging.app-usage-events.raw.v1"),
                rawEvents("app-usage-events.raw.v1,staging.app-usage-events.raw.v1")
        );
    }

    private static List<String> rawEvents(String value) {
        Binder binder = new Binder(new MapConfigurationPropertySource(Map.of(
                "processor.topics.raw-events", value,
                "processor.topics.dead-letter", "app-usage-events.dlq.v1",
                "processor.sessionization.abandonment-timeout", "PT6H",
                "processor.sessionization.abandonment-check-interval", "PT1M",
                "processor.rollups.daily-time-zone", "Asia/Singapore"
        )));
        return binder.bind("processor", ProcessorProperties.class).get().topics().rawEvents();
    }
}
