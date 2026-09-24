package com.personalusageanalytics.analytics.live;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;

import com.personalusageanalytics.analytics.web.LiveController;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LiveController.class)
@Import(LiveEventBroadcaster.class)
class LiveEventBroadcasterTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private LiveEventBroadcaster broadcaster;

    @Test
    void streamsPublishedEventsToSubscribers() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/live").accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted())
                .andReturn();
        assertEquals(1, broadcaster.subscribers());

        broadcaster.publish(new LiveEvent("OPEN", "Telegram", null, "iPhone 16 Pro", Instant.parse("2026-09-24T01:00:00Z"), null));

        String body = result.getResponse().getContentAsString();
        assertTrue(body.contains(":connected"), body);
        assertTrue(body.contains("event:pipeline"), body);
        assertTrue(body.contains("\"app\":\"Telegram\""), body);
    }
}
