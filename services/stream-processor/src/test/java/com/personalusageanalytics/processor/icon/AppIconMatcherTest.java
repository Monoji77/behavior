package com.personalusageanalytics.processor.icon;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

class AppIconMatcherTest {

    private static StoreApp listing(String name, String seller, String icon) {
        return new StoreApp(name, seller, icon, null);
    }

    @Test
    void matchesTheExactNameIgnoringCaseAndPunctuation() {
        assertEquals(Optional.of("paylah.png"), AppIconMatcher.match("DBS PayLah!", List.of(
                listing("DBS digibank", "DBS Bank", "digibank.png"),
                listing("DBS PayLah!", "DBS Bank", "paylah.png"))));
        assertEquals(Optional.of("disney.png"), AppIconMatcher.match("Disney+", List.of(
                listing("Disney+", "Disney", "disney.png"))));
    }

    @Test
    void prefersApplesListingForBuiltInNames() {
        assertEquals(Optional.of("apple-calendar.png"), AppIconMatcher.match("Calendar", List.of(
                listing("Calendar", "Some Developer", "other-calendar.png"),
                listing("Calendar", "Apple", "apple-calendar.png"))));
    }

    @Test
    void acceptsAListingThatAppendsATagline() {
        assertEquals(Optional.of("trip.png"), AppIconMatcher.match("Trip.com", List.of(
                listing("Trip.com: Book Flights, Hotels", "Trip.com", "trip.png"))));
    }

    @Test
    void rejectsUnrelatedListingsAndShortPrefixes() {
        assertEquals(Optional.empty(), AppIconMatcher.match("Citibank SG", List.of(
                listing("Citi Mobile Singapore", "Citigroup", "citi.png"))));
        assertEquals(Optional.empty(), AppIconMatcher.match("X", List.of(
                listing("Xylophone", "Someone", "xylophone.png"))));
        assertEquals(Optional.of("x.png"), AppIconMatcher.match("X", List.of(
                listing("X", "X Corp.", "x.png"))));
    }

    @Test
    void givesBuiltInsOnlyApplesListing() {
        assertEquals(Optional.empty(), AppIconMatcher.match("Settings", List.of(
                listing("Settings App For Phone", "Quiz Night Limited", "fake-settings.png"))));
        assertEquals(Optional.empty(), AppIconMatcher.match("Wallet", List.of(
                listing("Wallet", "Some Developer", "budget.png"),
                listing("Wallet: Budget & Money Manager", "BudgetBakers s.r.o.", "budget2.png"))));
    }

    @Test
    void matchesAListingPrefixedWithThePublisherName() {
        assertEquals(Optional.of("excel.png"), AppIconMatcher.match("Excel", List.of(
                listing("Excel Spreadsheet Maker", "Someone", "clone.png"),
                listing("Microsoft Excel", "Microsoft Corporation", "excel.png"))));
    }
}
