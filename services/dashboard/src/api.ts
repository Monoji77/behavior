export type Granularity = "HOUR" | "DAY";

export interface Filters {
  deviceId: string;
  app: string;
  granularity: Granularity;
  from: string;
  to: string;
}

export interface Session {
  sessionId: string;
  deviceId: string;
  app: string;
  source: string;
  openedAt: string;
  closedAt: string | null;
  durationMilliseconds: number | null;
  status: string;
  duplicateOpenCount: number;
  finalizedAt: string | null;
}

export interface UsageRollup {
  bucketStart: string;
  usageMilliseconds: number;
}

export interface DashboardData {
  longestSession: Session | null;
  rollups: UsageRollup[];
  topApps: TopApp[];
  pastWeekMilliseconds: number;
}

export interface FilterOptions {
  deviceIds: string[];
  apps: string[];
  earliestUsageAt: string | null;
  availableDates: string[];
  topApp: string | null;
  appIcons: Record<string, string>;
}

export interface TopApp {
  app: string;
  usageMilliseconds: number;
  iconUrl: string | null;
}

export interface CategoryUsage {
  category: string;
  usageMilliseconds: number;
  appCount: number;
}

export interface BehaviorSummary {
  totalUsageMilliseconds: number;
  appCount: number;
  categories: CategoryUsage[];
}

// App menu order: the week's top apps first (most used first), then the rest alphabetically.
export function appsWithTopFirst(apps: string[], topApps: TopApp[] | undefined): string[] {
  const top = (topApps ?? []).map((entry) => entry.app).filter((app) => apps.includes(app));
  return [...top, ...apps.filter((app) => !top.includes(app))];
}

export type AppRank = { position: number; entry: TopApp };

// The selected app's place in the week's top apps (0 = most used), or null if it isn't there.
export function selectedAppRank(topApps: TopApp[] | undefined, app: string): AppRank | null {
  const position = (topApps ?? []).findIndex((entry) => entry.app === app);
  return app && position >= 0 ? { position, entry: topApps![position] } : null;
}

export interface UsagePoint {
  bucketStart: string;
  usageMilliseconds: number;
}

// Every hour (or day) from the range's start to its end, with zero where there was
// no usage, so the chart always spans 00:00 of the start date to 23:59 of the end date.
// Range bounds are local "YYYY-MM-DDTHH:mm"; buckets are matched by instant.
export function fillUsageBuckets(buckets: Pick<UsageRollup, "bucketStart" | "usageMilliseconds">[], from: string, to: string, granularity: Granularity): UsagePoint[] {
  const usage = new Map(buckets.map((bucket) => [Date.parse(bucket.bucketStart), bucket.usageMilliseconds]));
  const cursor = new Date(from);
  const end = new Date(to);
  if (granularity === "DAY") cursor.setHours(0, 0, 0, 0); else cursor.setMinutes(0, 0, 0);
  const points: UsagePoint[] = [];
  while (cursor <= end && points.length < 24 * 400) {
    const at = cursor.getTime();
    points.push({ bucketStart: cursor.toISOString(), usageMilliseconds: usage.get(at) ?? 0 });
    usage.delete(at);
    if (granularity === "DAY") cursor.setDate(cursor.getDate() + 1); else cursor.setHours(cursor.getHours() + 1);
  }
  // Keep any bucket that didn't line up (e.g. a different timezone's day boundary).
  for (const [at, usageMilliseconds] of usage) points.push({ bucketStart: new Date(at).toISOString(), usageMilliseconds });
  return points.sort((a, b) => Date.parse(a.bucketStart) - Date.parse(b.bucketStart));
}

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
const shiftIsoDay = (day: string, days: number) => new Date(Date.parse(day + "T00:00:00Z") + days * DAY_MILLISECONDS).toISOString().slice(0, 10);

// Range to show for a selection, from its days with data (ascending YYYY-MM-DD):
// the last 3 days ending on the latest day with data, or every day when the data
// spans fewer than 3 days. Null when there is no data yet.
export function defaultDateRange(availableDates: string[]): { from: string; to: string } | null {
  if (!availableDates.length) return null;
  const last = availableDates[availableDates.length - 1];
  const threeDaysBack = shiftIsoDay(last, -2);
  const first = availableDates[0] > threeDaysBack ? availableDates[0] : threeDaysBack;
  return { from: first + "T00:00", to: last + "T23:59" };
}

export type DefaultSelection = { deviceId?: string; app?: string; done: boolean };

// On first load: pick a device, then that device's most-used app today.
// Never replaces something already chosen.
export function defaultSelection(deviceId: string, app: string, options: FilterOptions): DefaultSelection {
  if (!deviceId) {
    // This dashboard belongs to Chris's phone; retain a sensible fallback when
    // other devices are later connected.
    const device = options.deviceIds.find((item) => item === "iPhone 16 Pro") ?? options.deviceIds[0];
    return device ? { deviceId: device, done: false } : { done: true };
  }
  return !app && options.topApp ? { app: options.topApp, done: true } : { done: true };
}

interface DashboardResponse {
  buckets: UsageRollup[];
  pastWeekMilliseconds: number;
  longestSession: Session | null;
  topApps: TopApp[];
}

export class DashboardApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DashboardApiError";
  }
}

export function dashboardUrl(filters: Filters): string {
  const search = new URLSearchParams({
    deviceId: filters.deviceId,
    app: filters.app,
    granularity: filters.granularity,
    from: new Date(filters.from).toISOString(),
    to: new Date(filters.to).toISOString()
  });
  return `/api/v1/metrics/dashboard?${search.toString()}`;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new DashboardApiError(`Analytics API returned ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}

export function filterOptionsUrl(deviceId?: string, app?: string): string {
  const search = new URLSearchParams();
  if (deviceId) {
    search.set("deviceId", deviceId);
  }
  if (app) {
    search.set("app", app);
  }
  const query = search.toString();
  return "/api/v1/metrics/filter-options" + (query ? "?" + query : "");
}

export function loadFilterOptions(deviceId?: string, app?: string): Promise<FilterOptions> {
  return getJson<FilterOptions>(filterOptionsUrl(deviceId, app));
}

export function behaviorSummaryUrl(deviceId: string, from: string, to: string): string {
  const search = new URLSearchParams({ deviceId, from: new Date(from).toISOString(), to: new Date(to).toISOString() });
  return `/api/v1/metrics/behavior-summary?${search.toString()}`;
}

export function loadBehaviorSummary(deviceId: string, from: string, to: string, signal?: AbortSignal): Promise<BehaviorSummary> {
  return getJson<BehaviorSummary>(behaviorSummaryUrl(deviceId, from, to), signal);
}

const RATE_LIMIT_RETRY_MILLISECONDS = 1500;

const wait = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, milliseconds);
  signal?.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

// One request per selection; a rate-limited (429) response is retried once after a short pause.
export async function loadDashboard(filters: Filters, signal?: AbortSignal): Promise<DashboardData> {
  const url = dashboardUrl(filters);
  let response: DashboardResponse;
  try {
    response = await getJson<DashboardResponse>(url, signal);
  } catch (error) {
    if (!(error instanceof DashboardApiError && error.status === 429)) throw error;
    await wait(RATE_LIMIT_RETRY_MILLISECONDS, signal);
    response = await getJson<DashboardResponse>(url, signal);
  }
  return {
    longestSession: response.longestSession,
    rollups: response.buckets,
    topApps: response.topApps,
    pastWeekMilliseconds: response.pastWeekMilliseconds
  };
}
