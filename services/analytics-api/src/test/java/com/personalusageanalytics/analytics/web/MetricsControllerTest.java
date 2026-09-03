package com.personalusageanalytics.analytics.web;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.List;

import com.personalusageanalytics.analytics.model.RollupGranularity;
import com.personalusageanalytics.analytics.model.UsageRollup;
import com.personalusageanalytics.analytics.model.LatestSession;
import com.personalusageanalytics.analytics.persistence.AnalyticsRepository;
import com.personalusageanalytics.analytics.model.AnomalyCount;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(MetricsController.class)
class MetricsControllerTest {

        @Autowired
        private MockMvc mockMvc;

        @MockitoBean
        private AnalyticsRepository analyticsRepository;

        @Test
        void returnsTheLatestSession() throws Exception {
                UUID sessionId = UUID.fromString("11111111-1111-1111-1111-111111111111");

                when(analyticsRepository.findLatestSession("macbook-session-test", "instagram"))
                                .thenReturn(Optional.of(new LatestSession(
                                                sessionId,
                                                "macbook-session-test",
                                                "instagram",
                                                "ios-shortcuts",
                                                Instant.parse("2026-09-03T09:00:00Z"),
                                                Instant.parse("2026-09-03T09:15:00Z"),
                                                900_000L,
                                                "COMPLETED",
                                                0,
                                                Instant.parse("2026-09-03T09:15:01Z"))));

                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "latest-session")
                                .param("deviceId", "macbook-session-test")
                                .param("app", "instagram"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.metricName").value("latest-session"))
                                .andExpect(jsonPath("$.session.sessionId").value(sessionId.toString()))
                                .andExpect(jsonPath("$.session.app").value("instagram"))
                                .andExpect(jsonPath("$.session.durationMilliseconds").value(900_000))
                                .andExpect(jsonPath("$.session.status").value("COMPLETED"));
        }

        @Test
        void returnsNotFoundWhenNoSessionMatches() throws Exception {
                when(analyticsRepository.findLatestSession("unknown-device", "instagram"))
                                .thenReturn(Optional.empty());

                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "latest-session")
                                .param("deviceId", "unknown-device")
                                .param("app", "instagram"))
                                .andExpect(status().isNotFound());
        }

        @Test
        void rejectsAnUnsupportedMetricName() throws Exception {
                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "not-a-metric")
                                .param("deviceId", "macbook-session-test")
                                .param("app", "instagram"))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void returnsUsageRollupBuckets() throws Exception {
                Instant from = Instant.parse("2026-09-03T03:44:00Z");
                Instant to = Instant.parse("2026-09-03T03:46:00Z");

                when(analyticsRepository.findUsageRollups(
                                "macbook-session-test",
                                "instagram",
                                RollupGranularity.MINUTE,
                                from,
                                to)).thenReturn(List.of(
                                                new UsageRollup(
                                                                "macbook-session-test",
                                                                "instagram",
                                                                RollupGranularity.MINUTE,
                                                                "UTC",
                                                                Instant.parse("2026-09-03T03:44:00Z"),
                                                                20_930L,
                                                                Instant.parse("2026-09-03T03:45:52Z")),
                                                new UsageRollup(
                                                                "macbook-session-test",
                                                                "instagram",
                                                                RollupGranularity.MINUTE,
                                                                "UTC",
                                                                Instant.parse("2026-09-03T03:45:00Z"),
                                                                51_989L,
                                                                Instant.parse("2026-09-03T03:45:52Z"))));

                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "usage-rollup")
                                .param("deviceId", "macbook-session-test")
                                .param("app", "instagram")
                                .param("granularity", "MINUTE")
                                .param("from", "2026-09-03T03:44:00Z")
                                .param("to", "2026-09-03T03:46:00Z"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.metricName").value("usage-rollup"))
                                .andExpect(jsonPath("$.granularity").value("MINUTE"))
                                .andExpect(jsonPath("$.buckets.length()").value(2))
                                .andExpect(jsonPath("$.buckets[0].bucketStart")
                                                .value("2026-09-03T03:44:00Z"))
                                .andExpect(jsonPath("$.buckets[0].usageMilliseconds")
                                                .value(20_930))
                                .andExpect(jsonPath("$.buckets[1].usageMilliseconds")
                                                .value(51_989));
        }

        @Test
        void rejectsUsageRollupWithoutRequiredParameters() throws Exception {
                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "usage-rollup")
                                .param("deviceId", "macbook-session-test")
                                .param("app", "instagram"))
                                .andExpect(status().isBadRequest());
        }

        @Test
        void returnsAnomalySummary() throws Exception {
                Instant from = Instant.parse("2026-09-03T03:44:00Z");
                Instant to = Instant.parse("2026-09-03T03:46:00Z");

                when(analyticsRepository.findAnomalyCounts(
                                "macbook-session-test",
                                "instagram",
                                from,
                                to)).thenReturn(List.of(
                                                new AnomalyCount("DUPLICATE_OPEN", 1L)));

                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "anomaly-summary")
                                .param("deviceId", "macbook-session-test")
                                .param("app", "instagram")
                                .param("from", "2026-09-03T03:44:00Z")
                                .param("to", "2026-09-03T03:46:00Z"))
                                .andExpect(status().isOk())
                                .andExpect(jsonPath("$.metricName").value("anomaly-summary"))
                                .andExpect(jsonPath("$.totalAnomalies").value(1))
                                .andExpect(jsonPath("$.counts.length()").value(1))
                                .andExpect(jsonPath("$.counts[0].anomalyType")
                                                .value("DUPLICATE_OPEN"))
                                .andExpect(jsonPath("$.counts[0].count").value(1));
        }

        @Test
        void rejectsAnomalySummaryWithoutTimeRange() throws Exception {
                mockMvc.perform(get("/api/v1/metrics")
                                .param("metricName", "anomaly-summary")
                                .param("deviceId", "macbook-session-test")
                                .param("app", "instagram"))
                                .andExpect(status().isBadRequest());
        }
}