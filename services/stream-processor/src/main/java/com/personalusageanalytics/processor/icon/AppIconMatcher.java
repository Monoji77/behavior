package com.personalusageanalytics.processor.icon;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

// Picks the App Store listing that is the app the Shortcut named, or nothing.
// A wrong logo is worse than the letter fallback, so matching is strict.
final class AppIconMatcher {

    private static final int MIN_PREFIX_LENGTH = 4;

    // iOS system apps: only Apple's own listing is right, and several (Settings,
    // Wallet) aren't in the App Store at all, where a looser match finds an
    // unrelated third-party app. Normalized names.
    private static final Set<String> APPLE_BUILT_INS = Set.of(
            "appstore", "books", "calculator", "calendar", "camera", "clock", "compass", "contacts",
            "facetime", "files", "findmy", "fitness", "freeform", "health", "home", "journal", "magnifier",
            "mail", "maps", "measure", "messages", "music", "news", "notes", "passwords", "phone", "photos",
            "podcasts", "reminders", "safari", "settings", "shortcuts", "stocks", "tips", "translate", "tv",
            "voicememos", "wallet", "watch", "weather"
    );

    private AppIconMatcher() {
    }

    static Optional<String> match(String app, List<StoreApp> results) {
        String wanted = normalize(app);
        if (wanted.isEmpty()) {
            return Optional.empty();
        }

        // Exact name; built-ins such as "Calendar" share names with third-party
        // apps, so prefer Apple's own listing.
        Optional<StoreApp> exact = results.stream()
                .filter(result -> result.iconUrl() != null)
                .filter(result -> normalize(result.trackName()).equals(wanted))
                .min(Comparator.comparing(result -> isApple(result) ? 0 : 1));
        if (exact.isPresent()) {
            return exact.filter(result -> isApple(result) || !APPLE_BUILT_INS.contains(wanted)).map(StoreApp::iconUrl);
        }
        if (APPLE_BUILT_INS.contains(wanted)) {
            return Optional.empty();
        }

        // Publisher prefix: "Excel" is listed as "Microsoft Excel".
        Optional<StoreApp> publisherPrefixed = results.stream()
                .filter(result -> result.iconUrl() != null)
                .filter(result -> normalize(result.trackName()).equals(normalize(firstWord(result.sellerName())) + wanted))
                .findFirst();
        if (publisherPrefixed.isPresent()) {
            return publisherPrefixed.map(StoreApp::iconUrl);
        }

        // Listings often append a tagline ("Trip.com: Book Flights, Hotels").
        if (wanted.length() < MIN_PREFIX_LENGTH) {
            return Optional.empty();
        }
        return results.stream()
                .filter(result -> result.iconUrl() != null)
                .filter(result -> normalize(result.trackName()).startsWith(wanted))
                .findFirst()
                .map(StoreApp::iconUrl);
    }

    static String normalize(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]", "");
    }

    private static String firstWord(String value) {
        return value == null ? "" : value.trim().split("\\s+")[0];
    }

    private static boolean isApple(StoreApp result) {
        return result.sellerName() != null && result.sellerName().toLowerCase(Locale.ROOT).startsWith("apple");
    }
}
