import { FormEvent, useMemo, useState } from "react";
import {
  type DashboardData,
  type Filters,
  type Granularity,
  loadDashboard
} from "./api";

const defaultRange = (): Pick<Filters, "from" | "to"> => {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const local = (value: Date) => {
    const offset = value.getTimezoneOffset() * 60_000;
    return new Date(value.getTime() - offset).toISOString().slice(0, 16);
  };
  return { from: local(from), to: local(to) };
};

const initialRange = defaultRange();

function formatDuration(milliseconds: number | null | undefined): string {
  if (!milliseconds) return "—";
  const minutes = Math.round(milliseconds / 60_000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

function formatTime(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value)) : "—";
}

function UsageChart({ data }: { data: DashboardData["rollups"] }) {
  const maximum = Math.max(...data.map((bucket) => bucket.usageMilliseconds), 1);
  if (data.length === 0) {
    return <p className="muted empty-state">No usage was recorded for this range.</p>;
  }

  return (
    <div className="chart" aria-label="Usage by time bucket">
      {data.map((bucket) => {
        const height = Math.max((bucket.usageMilliseconds / maximum) * 100, 3);
        return (
          <div className="chart-column" key={bucket.bucketStart}>
            <span className="chart-value">{formatDuration(bucket.usageMilliseconds)}</span>
            <div className="chart-bar-wrap">
              <div className="chart-bar" style={{ height: `${height}%` }} />
            </div>
            <time dateTime={bucket.bucketStart} className="chart-label">
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric"
              }).format(new Date(bucket.bucketStart))}
            </time>
          </div>
        );
      })}
    </div>
  );
}

function App() {
  const [filters, setFilters] = useState<Filters>({
    deviceId: "",
    app: "",
    granularity: "HOUR",
    ...initialRange
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const totalUsage = useMemo(
    () => data?.rollups.reduce((total, bucket) => total + bucket.usageMilliseconds, 0) ?? 0,
    [data]
  );

  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setData(await loadDashboard(filters));
    } catch (requestError) {
      setData(null);
      setError(requestError instanceof Error ? requestError.message : "Unable to load metrics.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <header className="masthead">
        <div>
          <p className="eyebrow">Personal usage analytics</p>
          <h1>Usage Observatory</h1>
        </div>
        <p className="muted">Explore completed sessions, usage patterns, and processing anomalies.</p>
      </header>

      <section className="control-panel" aria-labelledby="filters-title">
        <div className="section-heading">
          <h2 id="filters-title">Explore activity</h2>
          <span className="api-badge">Analytics API</span>
        </div>
        <form onSubmit={submit}>
          <label>
            Device ID
            <input
              required
              value={filters.deviceId}
              onChange={(event) => update("deviceId", event.target.value)}
              placeholder="iphone-personal"
            />
          </label>
          <label>
            App
            <input
              required
              value={filters.app}
              onChange={(event) => update("app", event.target.value)}
              placeholder="instagram"
            />
          </label>
          <label>
            From
            <input
              required
              type="datetime-local"
              value={filters.from}
              onChange={(event) => update("from", event.target.value)}
            />
          </label>
          <label>
            To
            <input
              required
              type="datetime-local"
              value={filters.to}
              onChange={(event) => update("to", event.target.value)}
            />
          </label>
          <label>
            Group by
            <select
              value={filters.granularity}
              onChange={(event) => update("granularity", event.target.value as Granularity)}
            >
              <option value="MINUTE">Minute</option>
              <option value="HOUR">Hour</option>
              <option value="DAY">Day</option>
            </select>
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Loading…" : "Load dashboard"}
          </button>
        </form>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {!data && !loading && !error && (
        <section className="welcome-panel">
          <p className="eyebrow">Ready when you are</p>
          <h2>Choose a device and app to inspect its usage.</h2>
          <p className="muted">The dashboard queries the Analytics API; TimescaleDB remains private to the backend.</p>
        </section>
      )}

      {data && (
        <>
          <section className="summary-grid" aria-label="Usage summary">
            <article>
              <p>Usage in range</p>
              <strong>{formatDuration(totalUsage)}</strong>
            </article>
            <article>
              <p>Latest session</p>
              <strong>{formatDuration(data.latestSession?.durationMilliseconds)}</strong>
              <span>{data.latestSession?.status ?? "No completed session"}</span>
            </article>
            <article>
              <p>Anomalies</p>
              <strong>{data.totalAnomalies}</strong>
              <span>{data.totalAnomalies === 0 ? "All clear" : "Needs review"}</span>
            </article>
          </section>

          <section className="content-grid">
            <article className="card chart-card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Usage rollup</p>
                  <h2>Time in {filters.app}</h2>
                </div>
                <span className="muted">{filters.granularity.toLowerCase()} buckets</span>
              </div>
              <UsageChart data={data.rollups} />
            </article>

            <article className="card">
              <p className="eyebrow">Latest completed session</p>
              <h2>{data.latestSession ? formatDuration(data.latestSession.durationMilliseconds) : "No session found"}</h2>
              {data.latestSession && (
                <dl className="details">
                  <div><dt>Opened</dt><dd>{formatTime(data.latestSession.openedAt)}</dd></div>
                  <div><dt>Closed</dt><dd>{formatTime(data.latestSession.closedAt)}</dd></div>
                  <div><dt>Source</dt><dd>{data.latestSession.source}</dd></div>
                </dl>
              )}
            </article>

            <article className="card anomaly-card">
              <p className="eyebrow">Processing anomalies</p>
              <h2>{data.totalAnomalies === 0 ? "No anomalies" : `${data.totalAnomalies} detected`}</h2>
              {data.anomalies.length > 0 ? (
                <ul>
                  {data.anomalies.map((anomaly) => (
                    <li key={anomaly.anomalyType}>
                      <span>{anomaly.anomalyType}</span><strong>{anomaly.count}</strong>
                    </li>
                  ))}
                </ul>
              ) : <p className="muted">No anomalous events in this range.</p>}
            </article>
          </section>
        </>
      )}
    </main>
  );
}

export default App;
