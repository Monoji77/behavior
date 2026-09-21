import { type FormEvent, useEffect, useId, useMemo, useState } from "react";
import { type DashboardData, type Filters, type Granularity, type FilterOptions, loadDashboard, loadFilterOptions } from "./api";
import { DateRangeChip } from "./DateRangeChip";
import { GranularitySelect } from "./GranularitySelect";
import { RefreshButton, type RefreshStatus } from "./RefreshButton";

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
  return minutes >= 60 ? Math.floor(minutes / 60) + "h " + minutes % 60 + "m" : minutes + "m";
};
const time = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const dayFromDateTime = (value: string) => value.slice(0, 10);
const formatDay = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dayFromDateTime(value) + "T12:00:00"));

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.7" /><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.49 1.49M17.58 17.58l1.49 1.49M2 12h2.1M19.9 12H22M4.93 19.07l1.49-1.49M17.58 6.42l1.49-1.49" /></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 15.1A8.6 8.6 0 0 1 8.9 3.3 8.7 8.7 0 1 0 20.7 15.1Z" /></svg>; }
function Chevron() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>; }

function Metric({ label, value, detail, icon, tone = "violet" }: { label: string; value: string | number; detail: string; icon: string; tone?: string }) {
  return <article className="metric"><span className={"metric-icon " + tone}>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

function Combobox({ label, value, onChange, options, placeholder, loading }: { label: string; value: string; onChange: (value: string) => void; options: string[]; placeholder: string; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const listId = useId();
  useEffect(() => setQuery(value), [value]);
  const matches = options.filter((item) => item.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const close = () => window.setTimeout(() => { setOpen(false); setQuery(value); }, 120);
  return <label className="filter-pill combo-pill"><span>{label}</span><div className="combo-wrap"><input required role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} value={query} onFocus={() => setOpen(true)} onBlur={close} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} placeholder={placeholder} /> <Chevron />
    {open && <ul id={listId} role="listbox" className="option-list">{loading ? <li className="no-match">Loading available {label.toLocaleLowerCase()}s…</li> : matches.length ? matches.map((item) => <li key={item} role="option" aria-selected={item === value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(item); setQuery(item); setOpen(false); }}>{item}</li>) : <li className="no-match">No matching {label.toLocaleLowerCase()} found</li>}</ul>}
  </div></label>;
}

const axisLabel = (value: string, granularity: Granularity) => {
  const date = new Date(value);
  if (granularity === "DAY") return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: granularity === "MINUTE" ? "numeric" : undefined }).format(date);
};

function Trend({ data, granularity }: { data: DashboardData["rollups"]; granularity: Granularity }) {
  if (!data.length) return <div className="chart-empty">No activity was recorded for this range.</div>;
  const max = Math.max(...data.map(({ usageMilliseconds }) => usageMilliseconds), 1);
  const width = 700, height = 230, left = 48, right = 16, top = 16, bottom = 40;
  const x = (index: number) => left + (index / Math.max(data.length - 1, 1)) * (width - left - right);
  const y = (value: number) => top + (1 - value / max) * (height - top - bottom);
  const points = data.map((bucket, index) => x(index) + "," + y(bucket.usageMilliseconds)).join(" ");
  const area = left + "," + (height - bottom) + " " + points + " " + (width - right) + "," + (height - bottom);
  const labelled = data.filter((_, index) => index === 0 || index === data.length - 1 || index % Math.ceil(data.length / 5) === 0);
  const yTicks = [0, .25, .5, .75, 1];
  return <div className="trend-wrap"><svg className="trend" viewBox={[0, 0, width, height].join(" ")} role="img" aria-label="Usage trend, time in minutes">
    {yTicks.map((ratio) => <line key={ratio} className="gridline" x1={left} x2={width - right} y1={y(max * ratio)} y2={y(max * ratio)} />)}
    {yTicks.map((ratio) => <text key={ratio} className="axis y-axis" textAnchor="end" x={left - 8} y={y(max * ratio) + 4}>{Math.round((max * ratio) / 60_000)}m</text>)}
    <polygon className="trend-area" points={area} /><polyline className="trend-line" points={points} />
    {data.map((bucket, index) => <circle key={bucket.bucketStart} className="trend-point" cx={x(index)} cy={y(bucket.usageMilliseconds)} r="3" />)}
    {labelled.map((bucket) => { const index = data.indexOf(bucket); return <text key={bucket.bucketStart} className="axis" textAnchor="middle" x={x(index)} y={height - 10}>{axisLabel(bucket.bucketStart, granularity)}</text>; })}
  </svg><div className="chart-key"><span><i /> Usage time (minutes)</span><span>Peak: {duration(max)}</span></div></div>;
}

function App() {
  const [filters, setFilters] = useState<Filters>({ deviceId: "", app: "", granularity: "HOUR", ...initialRange });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ deviceIds: [], apps: [], earliestUsageAt: null });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => localStorage.getItem("behavior-theme") === "light" ? "light" : "dark");
  const [sparkle, setSparkle] = useState(false);
  const total = useMemo(() => data?.rollups.reduce((sum, item) => sum + item.usageMilliseconds, 0) ?? 0, [data]);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("behavior-theme", theme); }, [theme]);
  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    loadFilterOptions(filters.deviceId)
      .then((options) => { if (!cancelled) setFilterOptions(options); })
      .catch(() => { if (!cancelled) setFilterOptions((current) => filters.deviceId ? { ...current, apps: [] } : current); })
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [filters.deviceId]);
  useEffect(() => {
    if (filters.app && !filterOptions.apps.includes(filters.app)) {
      update("app", "");
    }
  }, [filterOptions.apps, filters.app]);
  function toggleTheme() { setSparkle(true); setTheme((current) => current === "dark" ? "light" : "dark"); window.setTimeout(() => setSparkle(false), 520); }
  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); setRefreshStatus("loading"); setError(null);
    try {
      setData(await loadDashboard(filters));
      setRefreshStatus("done");
    } catch (reason) {
      setData(null); setError(reason instanceof Error ? reason.message : "Unable to load metrics.");
      setRefreshStatus("error");
    } finally {
      window.setTimeout(() => setRefreshStatus("idle"), 1400);
    }
  }

  return <div className="shell">
    <aside className="sidebar"><a className="brand" href="#top"><b>U</b> Usage<span>OS</span></a><nav aria-label="Dashboard navigation"><a className="selected" href="#overview">▦ Overview</a><a href="#activity">⌁ Activity</a><a href="#session">◷ Sessions</a><a href="#anomalies">△ Anomalies</a></nav><p className="connection"><i /> Analytics API connected</p></aside>
    <main id="top"><header className="topbar"><div><p className="eyebrow">Phone Behavior Analytics</p><h1>Usage overview</h1></div><div className="live"><i /> Live data <button type="button" className={"theme-toggle " + (sparkle ? "sparkling" : "")} onClick={toggleTheme} aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"}><span className="theme-sun"><SunIcon /></span><span className="theme-moon"><MoonIcon /></span>{[0, 1, 2, 3, 4, 5].map((star) => <em key={star} className={"spark star-" + star}>✦</em>)}</button><b>CY</b></div></header>
      <section className="filters" aria-labelledby="filter-title"><div className="filter-intro"><p className="eyebrow">Explore activity</p><h2 id="filter-title">Refine your view</h2><p>Compare usage patterns, sessions, and processing anomalies.</p></div><form onSubmit={submit}>
        <Combobox label="Device" value={filters.deviceId} onChange={(value) => update("deviceId", value)} options={filterOptions.deviceIds} loading={optionsLoading} placeholder="Search available devices" />
        <Combobox label="App" value={filters.app} onChange={(value) => update("app", value)} options={filterOptions.apps} loading={optionsLoading} placeholder="Search available apps" />
        <RefreshButton status={refreshStatus} />
      </form></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section id="overview" className="metrics" aria-label="Usage summary"><Metric label="Time tracked" value={data ? duration(total) : "—"} detail={data ? "For selected range" : "Load a report to begin"} icon="◷" /><Metric label="Usage buckets" value={data ? data.rollups.length : "—"} detail={data ? filters.granularity.toLowerCase() + " intervals" : "Awaiting activity"} icon="⌁" tone="sky" /><Metric label="Latest session" value={data ? duration(data.latestSession?.durationMilliseconds) : "—"} detail={data?.latestSession?.status ?? "Awaiting activity"} icon="▣" tone="amber" /><Metric label="Anomalies" value={data ? data.totalAnomalies : "—"} detail={data ? (data.totalAnomalies ? "Needs review" : "All clear") : "No range selected"} icon="△" tone="rose" /></section>
      <section id="activity" className="dashboard-grid"><article className="panel trend-panel"><header><div><p className="eyebrow">Usage rollup</p><h2>Time in {filters.app || "your apps"}</h2></div><div className="rollup-controls"><DateRangeChip from={filters.from} to={filters.to} earliestUsageAt={filterOptions.earliestUsageAt} onChange={(from, to) => setFilters((current) => ({ ...current, from, to }))} /><GranularitySelect value={filters.granularity} onChange={(value) => update("granularity", value)} /></div></header>{data ? <Trend data={data.rollups} granularity={filters.granularity} /> : <div className="chart-empty">Your usage trend will appear here after you load a report.</div>}</article>
        <article id="session" className="panel session"><header><div><p className="eyebrow">Most recent</p><h2>Latest session</h2></div><span className="session-icon">◷</span></header>{data?.latestSession ? <><strong className="session-time">{duration(data.latestSession.durationMilliseconds)}</strong><span className="session-state">{data.latestSession.status}</span><dl><div><dt>Opened</dt><dd>{time(data.latestSession.openedAt)}</dd></div><div><dt>Closed</dt><dd>{time(data.latestSession.closedAt)}</dd></div><div><dt>Source</dt><dd>{data.latestSession.source}</dd></div></dl></> : <Empty title="No session loaded" text="Choose a device and app to see its latest completed session." />}</article></section>
      <section id="anomalies" className="dashboard-grid lower"><article className="panel anomalies"><header><div><p className="eyebrow">Data quality</p><h2>Processing anomalies</h2></div><span className={data?.totalAnomalies ? "pill risk" : "pill clear"}>{data?.totalAnomalies ? "Review" : "Clear"}</span></header>{data?.anomalies.length ? <ul>{data.anomalies.map((item) => <li key={item.anomalyType}><span>{item.anomalyType}</span><strong>{item.count}</strong></li>)}</ul> : <Empty title={data ? "No anomalies found" : "No report loaded"} text={data ? "This range processed without flagged events." : "An anomaly summary will appear with your report."} />}</article><article className="panel report"><p className="eyebrow">Current report</p><h2>{filters.app || "Select an app"}</h2><p>{filters.deviceId || "Select a device to load usage data"}</p><div><span>Range</span><strong>{formatDay(filters.from)} – {formatDay(filters.to)}</strong></div></article></section>
    </main></div>;
}
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><strong>{title}</strong><p>{text}</p></div>; }
export default App;
