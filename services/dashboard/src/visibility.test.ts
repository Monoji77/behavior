import { afterEach, describe, expect, it, vi } from "vitest";
import { appFingerprint, isExcludedApp, isVisibleActivity, isVisibleApp, isVisibleIdentifier } from "./visibility";
import { dailyRange, loadBehaviorSummary, loadCurrentActivity, loadFilterOptions, loadPipelineEvents } from "./api";

afterEach(() => vi.unstubAllGlobals());

describe("dashboard exclusions", () => {
  it("loads one current session and rejects diagnostic sessions from stale responses", async () => {
    const activity = { app: "Telegram", deviceId: "Phone", status: "ACTIVE", openedAt: "2026-09-28T08:00:00Z", closedAt: null, durationMilliseconds: null, iconUrl: null };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ activity })));
    vi.stubGlobal("fetch", fetch);
    expect(await loadCurrentActivity()).toEqual(activity);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/pipeline/current");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ activity: { ...activity, app: "private-test" } }))));
    expect(await loadCurrentActivity()).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ activity: null }))));
    expect(await loadCurrentActivity()).toBeNull();
  });
  it("requests the entire local day across a month boundary", () => {
    expect(dailyRange(new Date(2026, 8, 30, 23, 59))).toEqual({ from: "2026-09-30T00:00", to: "2026-10-01T00:00" });
  });

  it("shows the daily ranking while excluding hidden app entries from an older response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      totalUsageMilliseconds: 9000, appCount: 4, categories: [], topApps: [
        { app: "private-test", usageMilliseconds: 4000 }, { app: "Telegram", usageMilliseconds: 3000 },
        { app: "Netflix", usageMilliseconds: 2000 }, { app: "Instagram", usageMilliseconds: 1000 }
      ]
    }))));
    const summary = await loadBehaviorSummary("iPhone 16 Pro", "2026-09-28T00:00", "2026-09-29T00:00");
    expect(summary.topApps.map((app) => app.app)).toEqual(["Telegram", "Netflix", "Instagram"]);
  });
  it("excludes variants and diagnostic collectors while keeping real apps and unnamed closes", () => {
    expect(isExcludedApp("  pRiVaTe Example  ", new Set([appFingerprint("Private Example")]))).toBe(true);
    expect(isVisibleApp("connectivity-test")).toBe(false);
    expect(isVisibleIdentifier("shortcut-check-20260928043905")).toBe(false);
    expect(isVisibleIdentifier("diagnostic-vgaplt022")).toBe(false);
    expect(isVisibleApp("Contest")).toBe(true);
    expect(isVisibleActivity({ app: null, deviceId: "iPhone 16 Pro" })).toBe(true);
  });

  it("sanitizes stale selector responses, including defaults and icons", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      deviceIds: ["iPhone 16 Pro", "iphone-shortcut-test"], apps: ["Telegram", "private-test", "postman-test"],
      topApp: "private-test", appIcons: { "private-test": "hidden.png", Telegram: "telegram.png" }
    }))));
    const options = await loadFilterOptions();
    expect(options.deviceIds).toEqual(["iPhone 16 Pro"]);
    expect(options.apps).toEqual(["Telegram"]);
    expect(options.topApp).toBeNull();
    expect(options.appIcons).toEqual({ Telegram: "telegram.png" });
  });

  it("removes hidden events and closed app names from recent history", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([
      { kind: "OPEN", app: "private-test", deviceId: "iPhone 16 Pro", closedApps: [] },
      { kind: "CLOSE", app: null, deviceId: "iPhone 16 Pro", closedApps: ["Telegram", "private-test"] }
    ]))));
    const events = await loadPipelineEvents();
    expect(events).toHaveLength(1);
    expect(events[0].closedApps).toEqual(["Telegram"]);
  });
});
