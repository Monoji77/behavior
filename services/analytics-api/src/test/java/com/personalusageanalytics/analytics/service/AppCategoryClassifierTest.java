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
    }
}
