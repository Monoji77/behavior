import { describe, expect, it } from "vitest";
import { defaultSelection, filterOptionsUrl, metricUrl, type FilterOptions, type Filters } from "./api";

const filters: Filters = {
  deviceId: "phone-1",
  app: "instagram",
  granularity: "HOUR",
  from: "2026-09-17T00:00",
  to: "2026-09-17T12:00"
};

describe("metricUrl", () => {
  it("builds the latest-session request without a time range", () => {
    expect(metricUrl("latest-session", filters)).toBe(
      "/api/v1/metrics?metricName=latest-session&deviceId=phone-1&app=instagram"
    );
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
    deviceIds: ["iPhone 16 Pro"], apps: ["Calendar", "Spotify"], earliestUsageAt: null, availableDates: [], topApp: "Calendar", ...overrides
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
