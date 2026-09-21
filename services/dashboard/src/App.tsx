import { type FormEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, type TooltipContentProps, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { type DashboardData, type Filters, type Granularity, type FilterOptions, loadDashboard, loadFilterOptions } from "./api";
import { DateRangeChip } from "./DateRangeChip";
import { GranularitySelect } from "./GranularitySelect";
import { RefreshButton, type RefreshStatus } from "./RefreshButton";

const pad = (value: number) => String(value).padStart(2, "0");
const isoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shiftDay = (day: string, deltaDays: number) => {
  const date = new Date(day + "T00:00:00");
  date.setDate(date.getDate() + deltaDays);
  return isoDay(date);
};
const dayRange = (day: string) => ({ from: day + "T00:00", to: day + "T23:59" });
const threeDayRange = (endDay: string) => ({ from: shiftDay(endDay, -2) + "T00:00", to: endDay + "T23:59" });
const range = () => threeDayRange(isoDay(new Date()));
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
  const [filtering, setFiltering] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);
  const listId = useId();
  useEffect(() => setQuery(value), [value]);
  useEffect(() => () => { if (closeTimer.current !== undefined) window.clearTimeout(closeTimer.current); }, []);
  const matches = filtering ? options.filter((item) => item.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : options;
  const cancelClose = () => { if (closeTimer.current !== undefined) { window.clearTimeout(closeTimer.current); closeTimer.current = undefined; } };
  const close = () => { cancelClose(); closeTimer.current = window.setTimeout(() => { setOpen(false); setQuery(value); setFiltering(false); closeTimer.current = undefined; }, 120); };
  const select = (item: string) => { cancelClose(); onChange(item); setQuery(item); setOpen(false); setFiltering(false); };
  return <label className="filter-pill combo-pill"><span>{label}</span><div className="combo-wrap"><input required role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} value={query} onFocus={() => { cancelClose(); setOpen(true); setFiltering(false); }} onBlur={close} onChange={(event) => { setQuery(event.target.value); setOpen(true); setFiltering(true); }} placeholder={placeholder} /> <Chevron />
    {open && <ul id={listId} role="listbox" className="option-list">{loading ? <li className="no-match">Loading available {label.toLocaleLowerCase()}s…</li> : matches.length ? matches.map((item) => <li key={item} role="option" aria-selected={item === value} onPointerDown={(event) => event.preventDefault()} onClick={() => select(item)}>{item}</li>) : <li className="no-match">No matching {label.toLocaleLowerCase()} found</li>}</ul>}
  </div></label>;
}

const axisLabel = (value: string, granularity: Granularity) => {
  const date = new Date(value);
  if (granularity === "DAY") return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric" }).format(date);
};

const trendConfig: ChartConfig = { usage: { label: "Usage time", color: "var(--accent-bright)" } };

function TrendTooltip({ active, payload, granularity }: Partial<TooltipContentProps<number, string>> & { granularity: Granularity }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload as DashboardData["rollups"][number];
  return <div className="trend-tooltip"><strong>{duration(bucket.usageMilliseconds)}</strong><span>{axisLabel(bucket.bucketStart, granularity)}</span></div>;
}

function Trend({ data, granularity }: { data: DashboardData["rollups"]; granularity: Granularity }) {
  if (!data.length) return <div className="chart-empty">No activity was recorded for this range.</div>;
  const max = Math.max(...data.map(({ usageMilliseconds }) => usageMilliseconds), 1);
  return <div className="trend-wrap">
    <ChartContainer config={trendConfig} className="aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-usage)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-usage)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
        <XAxis dataKey="bucketStart" tickLine={false} axisLine={false} tickMargin={10} minTickGap={40} tick={{ fill: "var(--faint)", fontSize: 11 }} tickFormatter={(value: string) => axisLabel(value, granularity)} />
        <YAxis tickLine={false} axisLine={false} width={40} tick={{ fill: "var(--faint)", fontSize: 11 }} tickFormatter={(value: number) => Math.round(value / 60_000) + "m"} />
        <ChartTooltip cursor={{ stroke: "var(--color-usage)", strokeDasharray: "3 3" }} content={<TrendTooltip granularity={granularity} />} />
        <Area dataKey="usageMilliseconds" type="monotone" fill="url(#trendFill)" stroke="var(--color-usage)" strokeWidth={3} dot={{ r: 3, fill: "var(--panel)", stroke: "var(--color-usage)", strokeWidth: 2 }} activeDot={{ r: 5, fill: "var(--color-usage)", stroke: "var(--panel)", strokeWidth: 2 }} />
      </AreaChart>
    </ChartContainer>
    <div className="chart-key"><span><i /> Usage time (minutes)</span><span>Peak: {duration(max)}</span></div>
  </div>;
}

function App() {
  const [filters, setFilters] = useState<Filters>({ deviceId: "iphone-16-pro", app: "instagram", granularity: "HOUR", ...initialRange });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ deviceIds: [], apps: [], earliestUsageAt: null, availableDates: [] });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => localStorage.getItem("behavior-theme") === "light" ? "light" : "dark");
  const [sparkle, setSparkle] = useState(false);
  const hasAppliedDefaultDate = useRef(false);
  const total = useMemo(() => data?.rollups.reduce((sum, item) => sum + item.usageMilliseconds, 0) ?? 0, [data]);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("behavior-theme", theme); }, [theme]);
  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    loadFilterOptions(filters.deviceId, filters.app)
      .then((options) => {
        if (cancelled) return;
        setFilterOptions(options);
        if (!hasAppliedDefaultDate.current && options.availableDates.length) {
          hasAppliedDefaultDate.current = true;
          setFilters((current) => ({ ...current, ...threeDayRange(options.availableDates[options.availableDates.length - 1]) }));
        }
      })
      .catch(() => { if (!cancelled) setFilterOptions((current) => filters.deviceId ? { ...current, apps: [] } : current); })
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [filters.deviceId, filters.app]);
  useEffect(() => {
    if (!optionsLoading && filters.app && !filterOptions.apps.includes(filters.app)) {
      update("app", "");
    }
  }, [optionsLoading, filterOptions.apps, filters.app]);
  useEffect(() => {
    if (filters.deviceId && filters.app) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.deviceId, filters.app, filters.from, filters.to, filters.granularity]);
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
      <section id="overview" className="overview-row" aria-label="Usage summary">
        <article className="panel report report-card"><div><p className="eyebrow">Current report</p><h2>{filters.app || "Select an app"}</h2><p>{filters.deviceId || "Select a device to load usage data"}</p></div><div><span>Range</span><strong>{dayFromDateTime(filters.from) === dayFromDateTime(filters.to) ? formatDay(filters.from) : formatDay(filters.from) + " – " + formatDay(filters.to)}</strong></div></article>
        <div className="metrics"><Metric label="Time tracked" value={data ? duration(total) : "—"} detail={data ? "For selected range" : "Load a report to begin"} icon="◷" /><Metric label="Usage buckets" value={data ? data.rollups.length : "—"} detail={data ? filters.granularity.toLowerCase() + " intervals" : "Awaiting activity"} icon="⌁" tone="sky" /><Metric label="Latest session" value={data ? duration(data.latestSession?.durationMilliseconds) : "—"} detail={data?.latestSession?.status ?? "Awaiting activity"} icon="▣" tone="amber" /><Metric label="Anomalies" value={data ? data.totalAnomalies : "—"} detail={data ? (data.totalAnomalies ? "Needs review" : "All clear") : "No range selected"} icon="△" tone="rose" /></div>
      </section>
      <section id="activity" className="dashboard-grid"><article className="panel trend-panel"><header><div><p className="eyebrow">Usage rollup</p><h2>Time in {filters.app || "your apps"}</h2></div><div className="rollup-controls"><DateRangeChip from={filters.from} to={filters.to} earliestUsageAt={filterOptions.earliestUsageAt} availableDates={filterOptions.availableDates} onChange={(from, to) => setFilters((current) => ({ ...current, from, to }))} /><GranularitySelect value={filters.granularity} onChange={(value) => update("granularity", value)} /></div></header>{data ? <Trend data={data.rollups} granularity={filters.granularity} /> : <div className="chart-empty">Your usage trend will appear here after you load a report.</div>}</article>
        <article id="session" className="panel session"><header><div><p className="eyebrow">Most recent</p><h2>Latest session</h2></div><span className="session-icon">◷</span></header>{data?.latestSession ? <><strong className="session-time">{duration(data.latestSession.durationMilliseconds)}</strong><span className="session-state">{data.latestSession.status}</span><dl><div><dt>Opened</dt><dd>{time(data.latestSession.openedAt)}</dd></div><div><dt>Closed</dt><dd>{time(data.latestSession.closedAt)}</dd></div><div><dt>Source</dt><dd>{data.latestSession.source}</dd></div></dl></> : <Empty title="No session loaded" text="Choose a device and app to see its latest completed session." />}</article></section>
      <section id="anomalies" className="lower"><article className="panel anomalies"><header><div><p className="eyebrow">Data quality</p><h2>Processing anomalies</h2></div><span className={data?.totalAnomalies ? "pill risk" : "pill clear"}>{data?.totalAnomalies ? "Review" : "Clear"}</span></header>{data?.anomalies.length ? <ul>{data.anomalies.map((item) => <li key={item.anomalyType}><span>{item.anomalyType}</span><strong>{item.count}</strong></li>)}</ul> : <Empty title={data ? "No anomalies found" : "No report loaded"} text={data ? "This range processed without flagged events." : "An anomaly summary will appear with your report."} />}</article></section>
    </main></div>;
}
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><strong>{title}</strong><p>{text}</p></div>; }
export default App;
