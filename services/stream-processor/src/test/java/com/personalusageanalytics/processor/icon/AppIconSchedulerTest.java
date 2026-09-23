package com.personalusageanalytics.processor.icon;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;

class AppIconSchedulerTest {

    private final AppIconRepository repository = mock(AppIconRepository.class);
    private final AppIconLookupClient client = mock(AppIconLookupClient.class);

    private AppIconScheduler scheduler(boolean enabled) {
        return new AppIconScheduler(repository, client, new AppIconProperties(enabled, "SG", 10, Duration.ofDays(7)));
    }

    @Test
    void savesMatchedIconsAndRecordsMisses() throws Exception {
        when(repository.findAppsNeedingLookup(any(), anyInt())).thenReturn(List.of("Spotify", "Citibank SG"));
        when(client.search("Spotify", "SG")).thenReturn(List.of(new StoreApp("Spotify", "Spotify", "spotify.png", null)));
        when(client.search("Citibank SG", "SG")).thenReturn(List.of());

        scheduler(true).lookUpMissingIcons();

        verify(repository).saveLookup("Spotify", "spotify.png");
        verify(repository).saveLookup("Citibank SG", null);
    }

    @Test
    void stopsTheBatchWithoutSavingWhenALookupFails() throws Exception {
        when(repository.findAppsNeedingLookup(any(), anyInt())).thenReturn(List.of("Spotify", "Telegram"));
        when(client.search("Spotify", "SG")).thenThrow(new IllegalStateException("iTunes Search API returned 403"));

        scheduler(true).lookUpMissingIcons();

        verify(repository, never()).saveLookup(any(), any());
        verify(client, never()).search("Telegram", "SG");
    }

    @Test
    void doesNothingWhenDisabled() {
        scheduler(false).lookUpMissingIcons();
        verify(repository, never()).findAppsNeedingLookup(any(), anyInt());
    }
}
