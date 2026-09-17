import { type FormEvent, useMemo, useState } from "react";
import { type DashboardData, type Filters, type Granularity, loadDashboard } from "./api";

const range = () => {
  const to = new Date();
  const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
  const local = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  return { from: local(from), to: local(to) };
};

const initialRange = range();
const duration = (milliseconds?: number | null) => {
  if (!milliseconds) return "—";
  const minutes = Math.round(milliseconds / 60_000);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};
const time = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

function Metric({ label, value, detail, icon, tone = "violet" }: { label: string; value: string | number; detail: string; icon: string; tone?: string }) {
  return <article className="metric"><span className={`metric-icon ${tone}`}>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

function Trend({ data }: { data: DashboardData["rollups"] }) {
  if (!data.length) return <div className="chart-empty">No activity was recorded for this range.</div>;
  const max = Math.max(...data.map(({ usageMilliseconds }) => usageMilliseconds), 1);
  const width = 700, height = 230, left = 16, right = 16, top = 16, bottom = 32;
  const x = (index: number) => left + (index / Math.max(data.length - 1, 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const points = data.map((bucket, index) => `${x(index)},${y(bucket.usageMilliseconds)}`).join(" ");
  const area = `${left},${height - bottom} ${points} ${width - right},${height - bottom}`;
  const labelled = data.filter((_, index) => index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 5) === 0);
  return <div className="trend-wrap"><svg className="trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Usage trend">
    {[.25, .5, .75].map((ratio) => <line key={ratio} className="gridline" x1={left} x2={width - right} y1={y(max * ratio)} y2={y(max * ratio)} />)}
    <polygon className="trend-area" points={area} /><polyline className="trend-line" points={points} />
    {data.map((bucket, index) => <circle key={bucket.bucketStart} className="trend-point" cx={x(index)} cy={y(bucket.usageMilliseconds)} r="3" />)}
    {labelled.map((bucket) => { const index = data.indexOf(bucket); return <text key={bucket.bucketStart} className="axis" textAnchor="middle" x={x(index)} y={height - 10}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(bucket.bucketStart))}</text>; })}
  </svg><div className="chart-key"><span><i /> Usage time</span><span>Peak: {duration(max)}</span></div></div>;
}

function App() {
  const [filters, setFilters] = useState<Filters>({ deviceId: "", app: "", granularity: "HOUR", ...initialRange });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const total = useMemo(() => data?.rollups.reduce((sum, item) => sum + item.usageMilliseconds, 0) ?? 0, [data]);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError(null);
    try { setData(await loadDashboard(filters)); } catch (reason) { setData(null); setError(reason instanceof Error ? reason.message : "Unable to load metrics."); } finally { setLoading(false); }
  }

  return <div className="shell">
    <aside className="sidebar"><a className="brand" href="#top"><b>U</b> Usage<span>OS</span></a><nav aria-label="Dashboard navigation"><a className="selected" href="#overview">▦ Overview</a><a href="#activity">⌁ Activity</a><a href="#session">◷ Sessions</a><a href="#anomalies">△ Anomalies</a></nav><p className="connection"><i /> Analytics API connected</p></aside>
    <main id="top"><header className="topbar"><div><p className="eyebrow">Personal usage analytics</p><h1>Usage overview</h1></div><div className="live"><i /> Live data <b>CY</b></div></header>
      <section className="filters" aria-labelledby="filter-title"><div><p className="eyebrow">Explore activity</p><h2 id="filter-title">Choose a device and app</h2><p>Compare usage patterns, sessions, and processing anomalies.</p></div><form onSubmit={submit}>
        <label>Device ID<input required value={filters.deviceId} onChange={(event) => update("deviceId", event.target.value)} placeholder="iphone-personal" /></label>
        <label>App<input required value={filters.app} onChange={(event) => update("app", event.target.value)} placeholder="instagram" /></label>
        <label>From<input required type="datetime-local" value={filters.from} onChange={(event) => update("from", event.target.value)} /></label>
        <label>To<input required type="datetime-local" value={filters.to} onChange={(event) => update("to", event.target.value)} /></label>
        <label>Group by<select value={filters.granularity} onChange={(event) => update("granularity", event.target.value as Granularity)}><option value="MINUTE">Minute</option><option value="HOUR">Hour</option><option value="DAY">Day</option></select></label>
        <button disabled={loading}>{loading ? "Refreshing…" : "Refresh data"}</button>
      </form></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section id="overview" className="metrics" aria-label="Usage summary"><Metric label="Time tracked" value={data ? duration(total) : "—"} detail={data ? "For selected range" : "Load a report to begin"} icon="◷" /><Metric label="Usage buckets" value={data ? data.rollups.length : "—"} detail={data ? `${filters.granularity.toLowerCase()} intervals` : "Awaiting activity"} icon="⌁" tone="sky" /><Metric label="Latest session" value={data ? duration(data.latestSession?.durationMilliseconds) : "—"} detail={data?.latestSession?.status ?? "Awaiting activity"} icon="▣" tone="amber" /><Metric label="Anomalies" value={data ? data.totalAnomalies : "—"} detail={data ? (data.totalAnomalies ? "Needs review" : "All clear") : "No range selected"} icon="△" tone="rose" /></section>
      <section id="activity" className="dashboard-grid"><article className="panel trend-panel"><header><div><p className="eyebrow">Usage rollup</p><h2>Time in {filters.app || "your apps"}</h2></div><span className="pill">{filters.granularity.toLowerCase()} view</span></header>{data ? <Trend data={data.rollups} /> : <div className="chart-empty">Your usage trend will appear here after you load a report.</div>}</article>
        <article id="session" className="panel session"><header><div><p className="eyebrow">Most recent</p><h2>Latest session</h2></div><span className="session-icon">◷</span></header>{data?.latestSession ? <><strong className="session-time">{duration(data.latestSession.durationMilliseconds)}</strong><span className="session-state">{data.latestSession.status}</span><dl><div><dt>Opened</dt><dd>{time(data.latestSession.openedAt)}</dd></div><div><dt>Closed</dt><dd>{time(data.latestSession.closedAt)}</dd></div><div><dt>Source</dt><dd>{data.latestSession.source}</dd></div></dl></> : <Empty title="No session loaded" text="Choose a device and app to see its latest completed session." />}</article></section>
      <section id="anomalies" className="dashboard-grid lower"><article className="panel anomalies"><header><div><p className="eyebrow">Data quality</p><h2>Processing anomalies</h2></div><span className={data?.totalAnomalies ? "pill risk" : "pill clear"}>{data?.totalAnomalies ? "Review" : "Clear"}</span></header>{data?.anomalies.length ? <ul>{data.anomalies.map((item) => <li key={item.anomalyType}><span>{item.anomalyType}</span><strong>{item.count}</strong></li>)}</ul> : <Empty title={data ? "No anomalies found" : "No report loaded"} text={data ? "This range processed without flagged events." : "An anomaly summary will appear with your report."} />}</article><article className="panel report"><p className="eyebrow">Current report</p><h2>{filters.app || "Select an app"}</h2><p>{filters.deviceId || "Select a device to load usage data"}</p><div><span>Range</span><strong>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(filters.from))} – {new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(filters.to))}</strong></div></article></section>
    </main></div>;
}

function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><strong>{title}</strong><p>{text}</p></div>; }

export default App;
