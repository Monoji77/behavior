package com.personalusageanalytics.processor.icon;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;

import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

// Apple's public iTunes Search API (no key; roughly 20 requests per minute).
@Component
public class ItunesAppIconLookupClient implements AppIconLookupClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(TIMEOUT).build();
    private final JsonMapper jsonMapper;

    public ItunesAppIconLookupClient(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    public List<StoreApp> search(String term, String country) throws Exception {
        URI uri = URI.create("https://itunes.apple.com/search?entity=software&limit=25"
                + "&country=" + URLEncoder.encode(country, StandardCharsets.UTF_8)
                + "&term=" + URLEncoder.encode(term, StandardCharsets.UTF_8));
        HttpResponse<String> response = httpClient.send(
                HttpRequest.newBuilder(uri).timeout(TIMEOUT).GET().build(),
                HttpResponse.BodyHandlers.ofString()
        );
        if (response.statusCode() != 200) {
            throw new IllegalStateException("iTunes Search API returned " + response.statusCode());
        }
        return jsonMapper.readValue(response.body(), SearchResponse.class).results();
    }

    record SearchResponse(List<StoreApp> results) {
        SearchResponse {
            results = results == null ? List.of() : results;
        }
    }
}
