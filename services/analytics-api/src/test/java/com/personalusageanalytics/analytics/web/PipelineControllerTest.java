package com.personalusageanalytics.analytics.web;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.personalusageanalytics.analytics.model.StoredPipelineEvent;
import com.personalusageanalytics.analytics.model.CurrentActivity;
import com.personalusageanalytics.analytics.persistence.AnalyticsRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(PipelineController.class)
class PipelineControllerTest {
    @Autowired private MockMvc mvc;
    @MockitoBean private AnalyticsRepository repository;

    @Test
    void returnsOneActiveSessionWithItsOpenedTimestamp() throws Exception {
        when(repository.findCurrentActivity()).thenReturn(Optional.of(new CurrentActivity(
                "Phone", "Telegram", "telegram.png", "ACTIVE", Instant.parse("2026-09-28T08:00:00Z"), null, null)));
        mvc.perform(get("/api/v1/pipeline/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity.app").value("Telegram"))
                .andExpect(jsonPath("$.activity.status").value("ACTIVE"))
                .andExpect(jsonPath("$.activity.openedAt").value("2026-09-28T08:00:00Z"))
                .andExpect(jsonPath("$.activity.closedAt").isEmpty())
                .andExpect(jsonPath("$.activity.durationMilliseconds").isEmpty());
    }

    @Test
    void returnsTheClosedSessionDurationAndClosingTimestamp() throws Exception {
        when(repository.findCurrentActivity()).thenReturn(Optional.of(new CurrentActivity(
                "Phone", "Telegram", null, "COMPLETED", Instant.parse("2026-09-28T08:00:00Z"),
                Instant.parse("2026-09-28T08:01:15Z"), 75000L)));
        mvc.perform(get("/api/v1/pipeline/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity.status").value("COMPLETED"))
                .andExpect(jsonPath("$.activity.closedAt").value("2026-09-28T08:01:15Z"))
                .andExpect(jsonPath("$.activity.durationMilliseconds").value(75000));
    }

    @Test
    void returnsJsonWhenNoSessionExists() throws Exception {
        when(repository.findCurrentActivity()).thenReturn(Optional.empty());
        mvc.perform(get("/api/v1/pipeline/current"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity").isEmpty());
    }

    @Test
    void preservesAnonymousModeForCurrentActivity() {
        var session = new CurrentActivity("Phone", "Telegram", "telegram.png", "ACTIVE",
                Instant.parse("2026-09-28T08:00:00Z"), null, null);
        when(repository.findCurrentActivity()).thenReturn(Optional.of(session));
        var anonymous = new PipelineController(repository, true).current().activity();
        org.junit.jupiter.api.Assertions.assertNull(anonymous.app());
        org.junit.jupiter.api.Assertions.assertNull(anonymous.deviceId());
        org.junit.jupiter.api.Assertions.assertNull(anonymous.iconUrl());
        org.junit.jupiter.api.Assertions.assertEquals(session.openedAt(), anonymous.openedAt());
    }

    @Test
    void returnsStoredUnnamedClosesWithTheAppsTheyCompleted() throws Exception {
        when(repository.findRecentPipelineEvents()).thenReturn(List.of(new StoredPipelineEvent(
                UUID.fromString("11111111-1111-1111-1111-111111111111"), "CLOSE", null, null,
                "iPhone 16 Pro", Instant.parse("2026-09-28T07:00:00Z"), Instant.parse("2026-09-28T07:00:01Z"),
                List.of("Netflix", "Telegram"))));
        mvc.perform(get("/api/v1/pipeline/recent"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].kind").value("CLOSE"))
                .andExpect(jsonPath("$[0].storedAt").value("2026-09-28T07:00:01Z"))
                .andExpect(jsonPath("$[0].closedApps[0]").value("Netflix"));
    }
}
