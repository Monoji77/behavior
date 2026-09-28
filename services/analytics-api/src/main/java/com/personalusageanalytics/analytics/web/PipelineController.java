package com.personalusageanalytics.analytics.web;

import java.util.List;

import com.personalusageanalytics.analytics.model.StoredPipelineEvent;
import com.personalusageanalytics.analytics.persistence.AnalyticsRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PipelineController {
    private final AnalyticsRepository repository;
    private final boolean anonymous;

    public PipelineController(AnalyticsRepository repository, @Value("${live.anonymous:false}") boolean anonymous) {
        this.repository = repository;
        this.anonymous = anonymous;
    }

    @GetMapping("/api/v1/pipeline/recent")
    public List<StoredPipelineEvent> recent() {
        List<StoredPipelineEvent> events = repository.findRecentPipelineEvents();
        return anonymous ? events.stream().map(StoredPipelineEvent::anonymized).toList() : events;
    }
}
