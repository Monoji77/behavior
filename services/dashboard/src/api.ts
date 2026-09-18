export type Granularity = "MINUTE" | "HOUR" | "DAY";

export interface Filters {
  deviceId: string;
  app: string;
  granularity: Granularity;
  from: string;
  to: string;
}

export interface LatestSession {
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

export interface AnomalyCount {
  anomalyType: string;
  count: number;
}

export interface DashboardData {
  latestSession: LatestSession | null;
  rollups: UsageRollup[];
  totalAnomalies: number;
  anomalies: AnomalyCount[];
}

export interface FilterOptions {
  deviceIds: string[];
  apps: string[];
}

interface LatestSessionResponse {
  session: LatestSession;
}

interface UsageRollupResponse {
  buckets: UsageRollup[];
}

interface AnomalySummaryResponse {
  totalAnomalies: number;
  counts: AnomalyCount[];
}

export class DashboardApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "DashboardApiError";
  }
}

export function metricUrl(metricName: string, filters: Filters): string {
  const search = new URLSearchParams({
    metricName,
    deviceId: filters.deviceId,
    app: filters.app
  });

  if (metricName === "usage-rollup") {
    search.set("granularity", filters.granularity);
  }
  if (metricName !== "latest-session") {
    search.set("from", new Date(filters.from).toISOString());
    search.set("to", new Date(filters.to).toISOString());
  }
  return `/api/v1/metrics?${search.toString()}`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new DashboardApiError(`Analytics API returned ${response.status}.`, response.status);
  }
  return response.json() as Promise<T>;
}

export function filterOptionsUrl(deviceId?: string): string {
  const search = new URLSearchParams();
  if (deviceId) {
    search.set("deviceId", deviceId);
  }
  const query = search.toString();
  return "/api/v1/metrics/filter-options" + (query ? "?" + query : "");
}

export function loadFilterOptions(deviceId?: string): Promise<FilterOptions> {
  return getJson<FilterOptions>(filterOptionsUrl(deviceId));
}

export async function loadDashboard(filters: Filters): Promise<DashboardData> {
  const latest = getJson<LatestSessionResponse>(metricUrl("latest-session", filters))
    .then((response) => response.session)
    .catch((error: unknown) => {
      if (error instanceof DashboardApiError && error.status === 404) {
        return null;
      }
      throw error;
    });
  const rollups = getJson<UsageRollupResponse>(metricUrl("usage-rollup", filters));
  const anomalies = getJson<AnomalySummaryResponse>(metricUrl("anomaly-summary", filters));

  const [latestSession, rollupResponse, anomalyResponse] = await Promise.all([
    latest,
    rollups,
    anomalies
  ]);

  return {
    latestSession,
    rollups: rollupResponse.buckets,
    totalAnomalies: anomalyResponse.totalAnomalies,
    anomalies: anomalyResponse.counts
  };
}
