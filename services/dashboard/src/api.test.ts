import { describe, expect, it } from "vitest";
import { defaultSelection, filterOptionsUrl, longestSessionUrl, metricUrl, topAppsUrl, type FilterOptions, type Filters } from "./api";

const filters: Filters = {
  deviceId: "phone-1",
  app: "instagram",
  granularity: "HOUR",
  from: "2026-09-17T00:00",
  to: "2026-09-17T12:00"
};

describe("metricUrl", () => {
  it("builds the top-apps request for the device over the 7 days up to now", () => {
    const url = new URL(topAppsUrl("iPhone 16 Pro", new Date("2026-09-23T10:00:00Z")), "http://dashboard.test");
    expect(url.pathname).toBe("/api/v1/metrics/top-apps");
    expect(url.searchParams.get("deviceId")).toBe("iPhone 16 Pro");
    expect(url.searchParams.get("from")).toBe("2026-09-16T10:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-09-23T10:00:00.000Z");
    expect(url.searchParams.get("limit")).toBe("3");
  });

  it("builds the longest-session request for the 7 days up to now", () => {
    const url = new URL(longestSessionUrl(filters, new Date("2026-09-23T10:00:00Z")), "http://dashboard.test");
    expect(url.searchParams.get("metricName")).toBe("longest-session");
    expect(url.searchParams.get("deviceId")).toBe("phone-1");
    expect(url.searchParams.get("app")).toBe("instagram");
    expect(url.searchParams.get("from")).toBe("2026-09-16T10:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-09-23T10:00:00.000Z");
  });

  it("builds the rollup request with the required filters", () => {
    const url = new URL(metricUrl("usage-rollup", filters), "http://dashboard.test");
    expect(url.searchParams.get("granularity")).toBe("HOUR");
    expect(url.searchParams.get("from")).toBe(new Date(filters.from).toISOString());
    expect(url.searchParams.get("to")).toBe(new Date(filters.to).toISOString());
  });

  it("builds the real filter-options request with an optional device and app", () => {
    expect(filterOptionsUrl()).toBe("/api/v1/metrics/filter-options");
    expect(filterOptionsUrl("phone 1")).toBe("/api/v1/metrics/filter-options?deviceId=phone+1");
    expect(filterOptionsUrl("phone 1", "instagram")).toBe("/api/v1/metrics/filter-options?deviceId=phone+1&app=instagram");
  });
});

describe("defaultSelection", () => {
  const options = (overrides: Partial<FilterOptions>): FilterOptions => ({
    deviceIds: ["iPhone 16 Pro"], apps: ["Calendar", "Spotify"], earliestUsageAt: null, availableDates: [], topApp: "Calendar", appIcons: {}, ...overrides
  });

  it("picks the first device when none is selected", () => {
    expect(defaultSelection("", "", options({}))).toEqual({ deviceId: "iPhone 16 Pro", done: false });
  });

  it("then picks the device's most-used app today", () => {
    expect(defaultSelection("iPhone 16 Pro", "", options({}))).toEqual({ app: "Calendar", done: true });
  });

  it("never replaces an app that is already selected", () => {
    expect(defaultSelection("iPhone 16 Pro", "Spotify", options({}))).toEqual({ done: true });
  });

  it("stops when there is no data to choose from", () => {
    expect(defaultSelection("", "", options({ deviceIds: [] }))).toEqual({ done: true });
    expect(defaultSelection("iPhone 16 Pro", "", options({ topApp: null }))).toEqual({ done: true });
  });
});
