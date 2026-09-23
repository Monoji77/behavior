package com.personalusageanalytics.processor.icon;

import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

// Looks up App Store icons for apps that don't have one yet, a small batch at a
// time to stay under the iTunes Search API rate limit.
@Component
public class AppIconScheduler {

    private static final Logger log = LoggerFactory.getLogger(AppIconScheduler.class);

    private final AppIconRepository repository;
    private final AppIconLookupClient lookupClient;
    private final AppIconProperties properties;

    public AppIconScheduler(AppIconRepository repository, AppIconLookupClient lookupClient, AppIconProperties properties) {
        this.repository = repository;
        this.lookupClient = lookupClient;
        this.properties = properties;
    }

    @Scheduled(initialDelayString = "PT30S", fixedDelayString = "${processor.app-icons.lookup-interval:PT5M}")
    public void lookUpMissingIcons() {
        if (!properties.enabled()) {
            return;
        }
        Instant retryNoneBefore = Instant.now().minus(properties.retryAfter());
        for (String app : repository.findAppsNeedingLookup(retryNoneBefore, properties.batchSize())) {
            try {
                String iconUrl = AppIconMatcher.match(app, lookupClient.search(app, properties.country())).orElse(null);
                repository.saveLookup(app, iconUrl);
            } catch (Exception exception) {
                // Network or rate-limit trouble: leave the rest for the next run.
                log.warn("App icon lookup failed for {}: {}", app, exception.getMessage());
                return;
            }
        }
    }
}
