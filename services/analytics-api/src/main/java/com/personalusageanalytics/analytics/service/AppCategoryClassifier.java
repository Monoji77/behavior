package com.personalusageanalytics.analytics.service;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.personalusageanalytics.analytics.model.BehaviorCategory;
import org.springframework.stereotype.Component;

@Component
public class AppCategoryClassifier {
    // A one-character app name must be an exact match, not a substring match.
    private static final Map<String, BehaviorCategory> EXACT_APP_CATEGORIES = Map.ofEntries(
            Map.entry("x", BehaviorCategory.SOCIAL_AND_ENTERTAINMENT),
            Map.entry("mobilelegendsbangbang", BehaviorCategory.SOCIAL_AND_ENTERTAINMENT),
            Map.entry("chatgpt", BehaviorCategory.WORK_AND_PRODUCTIVITY),
            Map.entry("jira", BehaviorCategory.WORK_AND_PRODUCTIVITY),
            Map.entry("notes", BehaviorCategory.WORK_AND_PRODUCTIVITY),
            Map.entry("chagee", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("kris", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("prioritypass", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("senokoenergy", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("tripcom", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("uobtmrw", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("yuu", BehaviorCategory.FINANCE_AND_SHOPPING),
            Map.entry("motra", BehaviorCategory.HEALTH_AND_LIFESTYLE),
            Map.entry("appstore", BehaviorCategory.UTILITIES_AND_NAVIGATION),
            Map.entry("calculator", BehaviorCategory.UTILITIES_AND_NAVIGATION),
            Map.entry("google", BehaviorCategory.UTILITIES_AND_NAVIGATION),
            Map.entry("tailscale", BehaviorCategory.UTILITIES_AND_NAVIGATION));
    private static final Map<BehaviorCategory, Set<String>> KEYWORDS = Map.of(
            BehaviorCategory.SOCIAL_AND_ENTERTAINMENT, Set.of("instagram", "tiktok", "youtube", "netflix", "spotify", "reddit", "facebook", "twitter", "snapchat", "twitch", "pinterest", "disney", "hulu", "primevideo", "music", "game"),
            BehaviorCategory.COMMUNICATION, Set.of("whatsapp", "telegram", "signal", "messenger", "imessage", "messages", "gmail", "outlook", "mail", "phone", "facetime"),
            BehaviorCategory.WORK_AND_PRODUCTIVITY, Set.of("slack", "tinyspeck", "teams", "notion", "calendar", "docs", "sheets", "drive", "word", "excel", "powerpoint", "zoom", "todoist", "asana", "trello", "authenticator", "singpass", "github", "discord"),
            BehaviorCategory.FINANCE_AND_SHOPPING, Set.of("bank", "wallet", "paypal", "revolut", "shopee", "amazon", "lazada", "ebay", "grab", "uber", "googlepay", "singaporeair", "dbspaylah"),
            BehaviorCategory.HEALTH_AND_LIFESTYLE, Set.of("health", "fitness", "strava", "fitbit", "calm", "headspace", "myfitnesspal", "foodpanda", "deliveroo"),
            BehaviorCategory.LEARNING, Set.of("kindle", "duolingo", "coursera", "udemy", "khan", "quizlet", "canvas"),
            BehaviorCategory.UTILITIES_AND_NAVIGATION, Set.of("maps", "waze", "settings", "camera", "safari", "chrome", "browser", "weather", "clock", "photos", "files", "helloride", "anywheel"));

    public BehaviorCategory classify(String app) {
        String normalized = app == null ? "" : app.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return EXACT_APP_CATEGORIES.getOrDefault(normalized, KEYWORDS.entrySet().stream()
                .filter(entry -> entry.getValue().stream().anyMatch(normalized::contains))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(BehaviorCategory.OTHER));
    }
}
