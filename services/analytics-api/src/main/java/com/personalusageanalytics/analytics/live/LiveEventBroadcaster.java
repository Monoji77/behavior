package com.personalusageanalytics.analytics.live;

import java.io.IOException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import jakarta.annotation.PreDestroy;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

// Fans live events out to every open dashboard (Server-Sent Events).
@Component
public class LiveEventBroadcaster {

    private static final long STREAM_TIMEOUT_MILLISECONDS = 30 * 60 * 1000L;

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();
    // A comment every 20s keeps proxies from closing an idle stream.
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor(runnable -> {
        Thread thread = new Thread(runnable, "live-heartbeat");
        thread.setDaemon(true);
        return thread;
    });

    public LiveEventBroadcaster() {
        heartbeat.scheduleAtFixedRate(() -> sendToAll(SseEmitter.event().comment("keep-alive")), 20, 20, TimeUnit.SECONDS);
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MILLISECONDS);
        emitters.add(emitter);
        emitter.onCompletion(() -> emitters.remove(emitter));
        emitter.onTimeout(() -> emitters.remove(emitter));
        emitter.onError(error -> emitters.remove(emitter));
        try {
            emitter.send(SseEmitter.event().comment("connected"));
        } catch (IOException exception) {
            emitters.remove(emitter);
        }
        return emitter;
    }

    public void publish(LiveEvent event) {
        sendToAll(SseEmitter.event().name("pipeline").data(event));
    }

    int subscribers() {
        return emitters.size();
    }

    private void sendToAll(SseEmitter.SseEventBuilder event) {
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(event);
            } catch (IOException | IllegalStateException exception) {
                emitters.remove(emitter);
            }
        }
    }

    @PreDestroy
    void shutdown() {
        heartbeat.shutdownNow();
        emitters.forEach(SseEmitter::complete);
    }
}
