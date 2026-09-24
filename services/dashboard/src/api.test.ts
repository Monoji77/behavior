import { afterEach, describe, expect, it, vi } from "vitest";
import { liveEventLabel } from "./liveFlow";
import { appsWithTopFirst, dashboardUrl, defaultDateRange, defaultSelection, fillUsageBuckets, filterOptionsUrl, loadDashboard, selectedAppRank, type FilterOptions, type Filters } from "./api";

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

describe("defaultDateRange", () => {
  it("shows the last 3 days ending on the latest day with data", () => {
    expect(defaultDateRange(["2026-09-17", "2026-09-20", "2026-09-22", "2026-09-23"]))
      .toEqual({ from: "2026-09-21T00:00", to: "2026-09-23T23:59" });
  });

  it("shows every day when the data spans fewer than 3 days", () => {
    expect(defaultDateRange(["2026-09-22", "2026-09-23"])).toEqual({ from: "2026-09-22T00:00", to: "2026-09-23T23:59" });
    expect(defaultDateRange(["2026-09-23"])).toEqual({ from: "2026-09-23T00:00", to: "2026-09-23T23:59" });
  });

  it("crosses month boundaries and handles no data", () => {
    expect(defaultDateRange(["2026-09-28", "2026-10-01"])).toEqual({ from: "2026-09-29T00:00", to: "2026-10-01T23:59" });
    expect(defaultDateRange([])).toBeNull();
  });
});

describe("fillUsageBuckets", () => {
  const at = (local: string) => new Date(local).toISOString();

  it("spans every hour from the start date's 00:00 to the end date's 23:00, zero-filled", () => {
    const points = fillUsageBuckets([{ bucketStart: at("2026-09-22T09:00"), usageMilliseconds: 60_000 }], "2026-09-22T00:00", "2026-09-23T23:59", "HOUR");
    expect(points).toHaveLength(48);
    expect(points[0]).toEqual({ bucketStart: at("2026-09-22T00:00"), usageMilliseconds: 0 });
    expect(points[9].usageMilliseconds).toBe(60_000);
    expect(points[47].bucketStart).toBe(at("2026-09-23T23:00"));
  });

  it("spans every day of the range in day view", () => {
    const points = fillUsageBuckets([{ bucketStart: at("2026-09-22T00:00"), usageMilliseconds: 5 }], "2026-09-21T00:00", "2026-09-23T23:59", "DAY");
    expect(points.map((point) => point.usageMilliseconds)).toEqual([0, 5, 0]);
  });

  it("keeps a bucket that doesn't line up with the local grid", () => {
    const odd = { bucketStart: "2026-09-22T00:30:00.000Z", usageMilliseconds: 7 };
    expect(fillUsageBuckets([odd], "2026-09-22T00:00", "2026-09-22T23:59", "HOUR")).toContainEqual(odd);
  });
});

describe("appsWithTopFirst", () => {
  const top = (...apps: string[]) => apps.map((app, index) => ({ app, usageMilliseconds: 10 - index, iconUrl: null }));

  it("lists the week's top apps first, in rank order, then the rest alphabetically", () => {
    expect(appsWithTopFirst(["Calendar", "Instagram", "Shopee", "Spotify", "Telegram"], top("Telegram", "Spotify", "Shopee")))
      .toEqual(["Telegram", "Spotify", "Shopee", "Calendar", "Instagram"]);
  });

  it("keeps alphabetical order before the top apps are loaded and ignores unknown apps", () => {
    expect(appsWithTopFirst(["Calendar", "Telegram"], undefined)).toEqual(["Calendar", "Telegram"]);
    expect(appsWithTopFirst(["Calendar", "Telegram"], top("Deleted App", "Telegram"))).toEqual(["Telegram", "Calendar"]);
  });
});

describe("liveEventLabel", () => {
  const base = { deviceId: null, at: null, iconUrl: null, durationMilliseconds: null };
  it("describes opens and closes, with the session length when known", () => {
    expect(liveEventLabel({ ...base, kind: "OPEN", app: "Telegram" })).toBe("Telegram opened");
    expect(liveEventLabel({ ...base, kind: "CLOSE", app: "Telegram", durationMilliseconds: 125_000 })).toBe("Telegram closed · 2 min session");
  });
  it("stays generic when the stream is anonymous", () => {
    expect(liveEventLabel({ ...base, kind: "OPEN", app: null })).toBe("An app opened");
  });
});

