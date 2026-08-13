package com.personalusageanalytics.ingestion.web;

import java.util.UUID;

import com.personalusageanalytics.ingestion.event.UsageEventPublisher;
import com.personalusageanalytics.ingestion.event.UsageEventRequest;
import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/events") // This defines the base path for all API endpoints in this controller
public class UsageEventController {

    private final UsageEventPublisher usageEventPublisher;

    public UsageEventController(UsageEventPublisher usageEventPublisher) {
        this.usageEventPublisher = usageEventPublisher;
    }

    @PostMapping
    public ResponseEntity<AcceptedEventResponse> ingest(
            @Valid @RequestBody UsageEventRequest event
    ) {
        usageEventPublisher.publish(event);

        return ResponseEntity.accepted()
                .body(new AcceptedEventResponse(event.eventId()));
    }

    public record AcceptedEventResponse(UUID eventId) {
    }
}