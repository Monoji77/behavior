package com.personalusageanalytics.processor.rollup;

import java.time.Instant;
import java.time.ZoneId;

import com.personalusageanalytics.processor.config.ProcessorProperties;

import org.springframework.stereotype.Service;

@Service
public class UsageRollupService {

    private static final ZoneId UTC = ZoneId.of("UTC");

    private final UsageBucketAllocator bucketAllocator;
    private final UsageRollupRepository usageRollupRepository;
    private final ProcessorProperties processorProperties;

    public UsageRollupService(
            UsageBucketAllocator bucketAllocator,
            UsageRollupRepository usageRollupRepository,
            ProcessorProperties processorProperties
    ) {
        this.bucketAllocator = bucketAllocator;
        this.usageRollupRepository = usageRollupRepository;
        this.processorProperties = processorProperties;
    }

    public void recordCompletedSession(
            String deviceId,
            String app,
            Instant openedAt,
            Instant closedAt
    ) {
        recordUsage(deviceId, app, openedAt, closedAt,
                UsageBucketAllocator.Granularity.MINUTE, UTC);

        recordUsage(deviceId, app, openedAt, closedAt,
                UsageBucketAllocator.Granularity.HOUR, UTC);

        recordUsage(deviceId, app, openedAt, closedAt,
                UsageBucketAllocator.Granularity.DAY,
                ZoneId.of(processorProperties.rollups().dailyTimeZone()));
    }

    private void recordUsage(
            String deviceId,
            String app,
            Instant openedAt,
            Instant closedAt,
            UsageBucketAllocator.Granularity granularity,
            ZoneId zoneId
    ) {
        bucketAllocator.allocate(openedAt, closedAt, granularity, zoneId)
                .forEach(slice -> usageRollupRepository.addUsage(
                        deviceId,
                        app,
                        granularity,
                        zoneId.getId(),
                        slice
                ));
    }
}