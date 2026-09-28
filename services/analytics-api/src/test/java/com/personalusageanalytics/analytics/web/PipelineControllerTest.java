package com.personalusageanalytics.analytics.web;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.personalusageanalytics.analytics.model.StoredPipelineEvent;
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
