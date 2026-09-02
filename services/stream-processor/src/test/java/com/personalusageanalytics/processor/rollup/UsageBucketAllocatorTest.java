package com.personalusageanalytics.processor.rollup;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

import com.personalusageanalytics.processor.rollup.UsageBucketAllocator.Granularity;
import com.personalusageanalytics.processor.rollup.UsageBucketAllocator.UsageSlice;

import org.junit.jupiter.api.Test;

class UsageBucketAllocatorTest {

    private final UsageBucketAllocator allocator = new UsageBucketAllocator();

    @Test
    void splitsUsageAcrossMinuteBoundary() {
        List<UsageSlice> slices = allocator.allocate(
                Instant.parse("2026-08-31T10:00:59.500Z"),
                Instant.parse("2026-08-31T10:01:01.500Z"),
                Granularity.MINUTE,
                ZoneId.of("UTC")
        );

        assertEquals(List.of(
                new UsageSlice(
                        Instant.parse("2026-08-31T10:00:00Z"),
                        500
                ),
                new UsageSlice(
                        Instant.parse("2026-08-31T10:01:00Z"),
                        1_500
                )
        ), slices);
    }

    @Test
    void usesSingaporeMidnightForDailyBuckets() {
        List<UsageSlice> slices = allocator.allocate(
                Instant.parse("2026-08-31T15:59:59.500Z"),
                Instant.parse("2026-08-31T16:00:01.500Z"),
                Granularity.DAY,
                ZoneId.of("Asia/Singapore")
        );

        assertEquals(List.of(
                new UsageSlice(
                        Instant.parse("2026-08-30T16:00:00Z"),
                        500
                ),
                new UsageSlice(
                        Instant.parse("2026-08-31T16:00:00Z"),
                        1_500
                )
        ), slices);
    }
}