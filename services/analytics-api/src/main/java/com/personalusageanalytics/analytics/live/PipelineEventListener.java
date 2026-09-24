package com.personalusageanalytics.analytics.live;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;

import com.personalusageanalytics.analytics.persistence.AnalyticsRepository;
import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// LISTENs on the pipeline_events channel (fed by database triggers when the
// stream processor stores activity) and relays each notification to open
// dashboards. Uses its own connection so it never holds one from the pool.
@Component
public class PipelineEventListener implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(PipelineEventListener.class);
    private static final int POLL_MILLISECONDS = 5_000;
    private static final long RECONNECT_MILLISECONDS = 5_000;

    private final LiveEventBroadcaster broadcaster;
    private final AnalyticsRepository repository;
    private final JsonMapper jsonMapper;
    private final String url;
    private final String username;
    private final String password;
    private final boolean anonymous;
    private volatile boolean running;
    private Thread worker;

    public PipelineEventListener(
            LiveEventBroadcaster broadcaster,
            AnalyticsRepository repository,
            JsonMapper jsonMapper,
            @Value("${spring.datasource.url}") String url,
            @Value("${spring.datasource.username}") String username,
            @Value("${spring.datasource.password}") String password,
            @Value("${live.anonymous:false}") boolean anonymous
    ) {
        this.broadcaster = broadcaster;
        this.repository = repository;
        this.jsonMapper = jsonMapper;
        this.url = url;
        this.username = username;
        this.password = password;
        this.anonymous = anonymous;
    }

    @Override
    public void start() {
        running = true;
        worker = new Thread(this::listen, "pipeline-events-listener");
        worker.setDaemon(true);
        worker.start();
    }

    @Override
    public void stop() {
        running = false;
        if (worker != null) {
            worker.interrupt();
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    private void listen() {
        while (running) {
            try (Connection connection = DriverManager.getConnection(url, username, password)) {
                try (Statement statement = connection.createStatement()) {
                    statement.execute("LISTEN pipeline_events");
                }
                PGConnection pg = connection.unwrap(PGConnection.class);
                while (running) {
                    PGNotification[] notifications = pg.getNotifications(POLL_MILLISECONDS);
                    if (notifications == null) {
                        continue;
                    }
                    for (PGNotification notification : notifications) {
                        relay(notification.getParameter());
                    }
                }
            } catch (Exception exception) {
                if (!running) {
                    return;
                }
                log.warn("Live pipeline listener lost its connection, retrying: {}", exception.getMessage());
                try {
                    Thread.sleep(RECONNECT_MILLISECONDS);
                } catch (InterruptedException interrupted) {
                    return;
                }
            }
        }
    }

    private void relay(String payload) {
        try {
            broadcaster.publish(LiveEvents.fromNotification(payload, jsonMapper, repository::findAppIcon, anonymous));
        } catch (RuntimeException exception) {
            log.warn("Skipping unreadable pipeline event: {}", exception.getMessage());
        }
    }
}
