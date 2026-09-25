package com.personalusageanalytics.analytics.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.personalusageanalytics.analytics.model.BehaviorCategory;
import org.junit.jupiter.api.Test;

class AppCategoryClassifierTest {

    private final AppCategoryClassifier classifier = new AppCategoryClassifier();

    @Test
    void classifiesChrisConfiguredApps() {
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("Authenticator"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("Singpass"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("GitHub"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("Discord"));
        assertEquals(BehaviorCategory.SOCIAL_AND_ENTERTAINMENT, classifier.classify("X"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("Excel"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("Google Pay Singapore"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("SingaporeAir"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("DBS PayLah!"));
        assertEquals(BehaviorCategory.UTILITIES_AND_NAVIGATION, classifier.classify("HelloRide"));
        assertEquals(BehaviorCategory.UTILITIES_AND_NAVIGATION, classifier.classify("Anywheel"));
        assertEquals(BehaviorCategory.SOCIAL_AND_ENTERTAINMENT, classifier.classify("Mobile Legends: Bang Bang"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("ChatGPT"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("Jira"));
        assertEquals(BehaviorCategory.WORK_AND_PRODUCTIVITY, classifier.classify("Notes"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("CHAGEE"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("Kris+"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("Priority Pass"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("Senoko Energy"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("Trip.com"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("UOB TMRW"));
        assertEquals(BehaviorCategory.FINANCE_AND_SHOPPING, classifier.classify("yuu"));
        assertEquals(BehaviorCategory.HEALTH_AND_LIFESTYLE, classifier.classify("Motra"));
        assertEquals(BehaviorCategory.UTILITIES_AND_NAVIGATION, classifier.classify("App Store"));
        assertEquals(BehaviorCategory.UTILITIES_AND_NAVIGATION, classifier.classify("Calculator"));
        assertEquals(BehaviorCategory.UTILITIES_AND_NAVIGATION, classifier.classify("Google"));
        assertEquals(BehaviorCategory.UTILITIES_AND_NAVIGATION, classifier.classify("Tailscale"));
    }
}
