package com.personalusageanalytics.analytics.service;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

import com.personalusageanalytics.analytics.model.BehaviorCategory;
import org.springframework.stereotype.Component;

@Component
public class AppCategoryClassifier {
    private static final Map<BehaviorCategory, Set<String>> KEYWORDS = Map.of(
            BehaviorCategory.SOCIAL_AND_ENTERTAINMENT, Set.of("instagram", "tiktok", "youtube", "netflix", "spotify", "reddit", "facebook", "twitter", "snapchat", "twitch", "pinterest", "disney", "hulu", "primevideo", "music", "game"),
            BehaviorCategory.COMMUNICATION, Set.of("whatsapp", "telegram", "signal", "messenger", "imessage", "messages", "gmail", "outlook", "mail", "phone", "facetime"),
            BehaviorCategory.WORK_AND_PRODUCTIVITY, Set.of("slack", "tinyspeck", "teams", "notion", "calendar", "docs", "sheets", "drive", "word", "excel", "powerpoint", "zoom", "todoist", "asana", "trello"),
            BehaviorCategory.FINANCE_AND_SHOPPING, Set.of("bank", "wallet", "paypal", "revolut", "shopee", "amazon", "lazada", "ebay", "grab", "uber"),
            BehaviorCategory.HEALTH_AND_LIFESTYLE, Set.of("health", "fitness", "strava", "fitbit", "calm", "headspace", "myfitnesspal", "foodpanda", "deliveroo"),
            BehaviorCategory.LEARNING, Set.of("kindle", "duolingo", "coursera", "udemy", "khan", "quizlet", "canvas"),
            BehaviorCategory.UTILITIES_AND_NAVIGATION, Set.of("maps", "waze", "settings", "camera", "safari", "chrome", "browser", "weather", "clock", "photos", "files"));

    public BehaviorCategory classify(String app) {
        String normalized = app == null ? "" : app.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return KEYWORDS.entrySet().stream().filter(entry -> entry.getValue().stream().anyMatch(normalized::contains)).map(Map.Entry::getKey).findFirst().orElse(BehaviorCategory.OTHER);
    }
}
