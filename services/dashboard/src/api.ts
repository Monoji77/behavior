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

export type AppRank = { position: number; entry: TopApp };

// The selected app's place in the week's top apps (0 = most used), or null if it isn't there.
export function selectedAppRank(topApps: TopApp[] | undefined, app: string): AppRank | null {
  const position = (topApps ?? []).findIndex((entry) => entry.app === app);
  return app && position >= 0 ? { position, entry: topApps![position] } : null;
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
