package com.personalusageanalytics.processor.icon;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

// One iTunes Search API result; only the fields used for matching.
@JsonIgnoreProperties(ignoreUnknown = true)
public record StoreApp(
        String trackName,
        String sellerName,
        String artworkUrl512,
        String artworkUrl100
) {
    String iconUrl() {
        return artworkUrl512 != null ? artworkUrl512 : artworkUrl100;
    }
}
