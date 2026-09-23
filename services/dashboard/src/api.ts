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

export type DefaultSelection = { deviceId?: string; app?: string; done: boolean };

// On first load: pick a device, then that device's most-used app today.
// Never replaces something already chosen.
export function defaultSelection(deviceId: string, app: string, options: FilterOptions): DefaultSelection {
  if (!deviceId) {
    const device = options.deviceIds[0];
    return device ? { deviceId: device, done: false } : { done: true };
  }
  return !app && options.topApp ? { app: options.topApp, done: true } : { done: true };
}

interface SessionResponse {
  session: Session;
}

interface TopAppsResponse {
  apps: TopApp[];
}

interface UsageRollupResponse {
  buckets: UsageRollup[];
}

export class DashboardApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DashboardApiError";
  }
}

const WEEK_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

export function metricUrl(metricName: string, filters: Filters): string {
  const search = new URLSearchParams({
    metricName,
    deviceId: filters.deviceId,
    app: filters.app
  });

  if (metricName === "usage-rollup") {
    search.set("granularity", filters.granularity);
  }
  search.set("from", new Date(filters.from).toISOString());
  search.set("to", new Date(filters.to).toISOString());
  return `/api/v1/metrics?${search.toString()}`;
}

const pastWeek = (now: Date) => ({
  from: new Date(now.getTime() - WEEK_MILLISECONDS).toISOString(),
  to: now.toISOString()
});

// The device's most-used apps over the 7 days up to now.
export function topAppsUrl(deviceId: string, now = new Date(), limit = 3): string {
  const search = new URLSearchParams({ deviceId, ...pastWeek(now), limit: String(limit) });
  return `/api/v1/metrics/top-apps?${search.toString()}`;
}

// Always the 7 days up to now, independent of the chart's selected range.
export function longestSessionUrl(filters: Pick<Filters, "deviceId" | "app">, now = new Date()): string {
  const search = new URLSearchParams({
    metricName: "longest-session",
    deviceId: filters.deviceId,
    app: filters.app,
    ...pastWeek(now)
  });
  return `/api/v1/metrics?${search.toString()}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
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

export async function loadDashboard(filters: Filters): Promise<DashboardData> {
  const longest = getJson<SessionResponse>(longestSessionUrl(filters))
    .then((response) => response.session)
    .catch((error: unknown) => {
      if (error instanceof DashboardApiError && error.status === 404) {
        return null;
      }
      throw error;
    });
  const rollups = getJson<UsageRollupResponse>(metricUrl("usage-rollup", filters));
  const topApps = getJson<TopAppsResponse>(topAppsUrl(filters.deviceId));

  const [longestSession, rollupResponse, topAppsResponse] = await Promise.all([longest, rollups, topApps]);

  return {
    longestSession,
    rollups: rollupResponse.buckets,
    topApps: topAppsResponse.apps
  };
}
