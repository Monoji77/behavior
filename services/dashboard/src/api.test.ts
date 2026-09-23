import { afterEach, describe, expect, it, vi } from "vitest";
import { dashboardUrl, defaultSelection, filterOptionsUrl, loadDashboard, selectedAppRank, type FilterOptions, type Filters } from "./api";

const filters: Filters = {
  deviceId: "phone-1",
  app: "instagram",
  granularity: "HOUR",
  from: "2026-09-17T00:00",
  to: "2026-09-17T12:00"
};

describe("dashboardUrl", () => {
  it("asks for the whole dashboard of one selection in a single request", () => {
    const url = new URL(dashboardUrl(filters), "http://dashboard.test");
    expect(url.pathname).toBe("/api/v1/metrics/dashboard");
    expect(url.searchParams.get("deviceId")).toBe("phone-1");
    expect(url.searchParams.get("app")).toBe("instagram");
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

describe("loadDashboard", () => {
  const body = { buckets: [], pastWeekMilliseconds: 60_000, longestSession: null, topApps: [] };
  const reply = (status: number) => new Response(status === 200 ? JSON.stringify(body) : "", { status });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("retries once after a rate-limited response", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValueOnce(reply(429)).mockResolvedValueOnce(reply(200));
    vi.stubGlobal("fetch", fetchMock);
    const result = loadDashboard(filters);
    await vi.advanceTimersByTimeAsync(1500);
    await expect(result).resolves.toMatchObject({ pastWeekMilliseconds: 60_000 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with the 429 when the retry is rate-limited too", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(429)));
    const result = loadDashboard(filters);
    const assertion = expect(result).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(1500);
    await assertion;
  });

  it("does not retry when the selection was superseded", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(reply(429));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    const result = loadDashboard(filters, controller.signal);
    const assertion = expect(result).rejects.toBeDefined();
    await vi.advanceTimersByTimeAsync(100);
    controller.abort();
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

describe("selectedAppRank", () => {
  const topApps = [
    { app: "Telegram", usageMilliseconds: 3, iconUrl: null },
    { app: "Spotify", usageMilliseconds: 2, iconUrl: null },
    { app: "Shopee", usageMilliseconds: 1, iconUrl: null }
  ];

  it("returns the selected app's position when it is in the top 3", () => {
    expect(selectedAppRank(topApps, "Spotify")).toEqual({ position: 1, entry: topApps[1] });
  });

  it("returns null when the selected app is not in the top 3 or nothing is loaded", () => {
    expect(selectedAppRank(topApps, "Calendar")).toBeNull();
    expect(selectedAppRank(undefined, "Spotify")).toBeNull();
    expect(selectedAppRank(topApps, "")).toBeNull();
  });
});

