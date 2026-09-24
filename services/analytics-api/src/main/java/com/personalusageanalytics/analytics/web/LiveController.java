package com.personalusageanalytics.analytics.web;

import com.personalusageanalytics.analytics.live.LiveEventBroadcaster;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// Server-Sent Events stream of live pipeline activity for the dashboard.
@RestController
@RequestMapping("/api/v1/live")
public class LiveController {

    private final LiveEventBroadcaster broadcaster;

    public LiveController(LiveEventBroadcaster broadcaster) {
        this.broadcaster = broadcaster;
    }

    @GetMapping(produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter live() {
        return broadcaster.subscribe();
    }
}
