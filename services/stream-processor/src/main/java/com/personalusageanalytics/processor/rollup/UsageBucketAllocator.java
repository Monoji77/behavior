package com.personalusageanalytics.processor.rollup;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

import org.springframework.stereotype.Component;

@Component
public class UsageBucketAllocator {

    public List<UsageSlice> allocate(
            Instant sessionStart,
            Instant sessionEnd,
            Granularity granularity,
            ZoneId zoneId
    ) {
        Objects.requireNonNull(sessionStart);
        Objects.requireNonNull(sessionEnd);
        Objects.requireNonNull(granularity);
        Objects.requireNonNull(zoneId);

        if (!sessionEnd.isAfter(sessionStart)) {
            return List.of();
        }

        List<UsageSlice> slices = new ArrayList<>();
        Instant bucketStart = bucketStart(sessionStart, granularity, zoneId);

        while (bucketStart.isBefore(sessionEnd)) {
            Instant nextBucketStart = nextBucketStart(
                    bucketStart,
                    granularity,
                    zoneId
            );

            Instant sliceStart = sessionStart.isAfter(bucketStart)
                    ? sessionStart
                    : bucketStart;

            Instant sliceEnd = sessionEnd.isBefore(nextBucketStart)
                    ? sessionEnd
                    : nextBucketStart;

            if (sliceEnd.isAfter(sliceStart)) {
                slices.add(new UsageSlice(
                        bucketStart,
                        Duration.between(sliceStart, sliceEnd).toMillis()
                ));
            }

            bucketStart = nextBucketStart;
        }

        return slices;
    }

    private Instant bucketStart(
            Instant instant,
            Granularity granularity,
            ZoneId zoneId
    ) {
        ZonedDateTime time = instant.atZone(zoneId);

        return switch (granularity) {
            case MINUTE -> time.truncatedTo(ChronoUnit.MINUTES).toInstant();
            case HOUR -> time.truncatedTo(ChronoUnit.HOURS).toInstant();
            case DAY -> time.toLocalDate().atStartOfDay(zoneId).toInstant();
        };
    }

    private Instant nextBucketStart(
            Instant bucketStart,
            Granularity granularity,
            ZoneId zoneId
    ) {
        ZonedDateTime time = bucketStart.atZone(zoneId);

        return switch (granularity) {
            case MINUTE -> time.plusMinutes(1).toInstant();
            case HOUR -> time.plusHours(1).toInstant();
            case DAY -> time.toLocalDate().plusDays(1)
                    .atStartOfDay(zoneId)
                    .toInstant();
        };
    }

    public enum Granularity {
        MINUTE,
        HOUR,
        DAY
    }

    public record UsageSlice(
            Instant bucketStart,
            long usageMilliseconds
    ) {
    }
}