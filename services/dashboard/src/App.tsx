import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, type TooltipContentProps, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppIcon } from "./AppIcon";
import { FilterMenu } from "./FilterMenu";
import { type DashboardData, type Filters, type Granularity, type FilterOptions, defaultSelection, loadDashboard, loadFilterOptions, selectedAppRank } from "./api";
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
  return minutes >= 60 ? Math.floor(minutes / 60) + "h " + minutes % 60 + " min" : minutes + " min";
};
const time = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const dayFromDateTime = (value: string) => value.slice(0, 10);
const formatDay = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dayFromDateTime(value) + "T12:00:00"));

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.7" /><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.49 1.49M17.58 17.58l1.49 1.49M2 12h2.1M19.9 12H22M4.93 19.07l1.49-1.49M17.58 6.42l1.49-1.49" /></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 15.1A8.6 8.6 0 0 1 8.9 3.3 8.7 8.7 0 1 0 20.7 15.1Z" /></svg>; }

function Metric({ id, label, value, detail, icon, tone = "violet", children }: { id?: string; label: string; value: string | number; detail?: string; icon: string; tone?: string; children?: ReactNode }) {
  return <article id={id} className="metric"><span className={"metric-icon " + tone}>{icon}</span><p>{label}</p><strong>{value}</strong>{detail && <small>{detail}</small>}{children}</article>;
}

const axisLabel = (value: string, granularity: Granularity) => {
  const date = new Date(value);
  if (granularity === "DAY") return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric" }).format(date);
};

const RANKS = ["Top used app", "Second most used app", "Third most used app"];

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
        <YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: "var(--faint)", fontSize: 11 }} tickFormatter={(value: number) => Math.round(value / 60_000) + " min"} />
        <ChartTooltip cursor={{ stroke: "var(--color-usage)", strokeDasharray: "3 3" }} content={<TrendTooltip granularity={granularity} />} />
        <Area dataKey="usageMilliseconds" type="monotone" fill="url(#trendFill)" stroke="var(--color-usage)" strokeWidth={3} dot={{ r: 3, fill: "var(--panel)", stroke: "var(--color-usage)", strokeWidth: 2 }} activeDot={{ r: 5, fill: "var(--color-usage)", stroke: "var(--panel)", strokeWidth: 2 }} />
      </AreaChart>
    </ChartContainer>
    <div className="chart-key"><span><i /> Usage time (minutes)</span><span>Peak: {duration(max)}</span></div>
  </div>;
}

function App() {
  const [filters, setFilters] = useState<Filters>({ deviceId: "", app: "", granularity: "HOUR", ...initialRange });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ deviceIds: [], apps: [], earliestUsageAt: null, availableDates: [], topApp: null, appIcons: {} });
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [theme, setTheme] = useState<"dark" | "light">(() => localStorage.getItem("behavior-theme") === "light" ? "light" : "dark");
  const [sparkle, setSparkle] = useState(false);
  const hasAppliedDefaultDate = useRef(false);
  const hasAppliedDefaultSelection = useRef(false);
  const rank = selectedAppRank(data?.topApps, filters.app);
  const rangeLabel = dayFromDateTime(filters.from) === dayFromDateTime(filters.to) ? formatDay(filters.from) : formatDay(filters.from) + " – " + formatDay(filters.to);
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
        if (!hasAppliedDefaultSelection.current) {
          const { done, ...selection } = defaultSelection(filters.deviceId, filters.app, options);
          hasAppliedDefaultSelection.current = done;
          if (selection.deviceId || selection.app) setFilters((current) => ({ ...current, ...selection }));
        }
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
    event?.preventDefault();
    // The inputs' `required` only sees typed text, not a chosen option; never query with nothing selected.
    if (!filters.deviceId || !filters.app) { setData(null); setError("Choose a device and an app from the list."); return; }
    setRefreshStatus("loading"); setError(null);
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

  return <TooltipProvider delay={150}><div className="shell">
    <aside className="sidebar"><a className="brand" href="#top"><b>U</b> Usage<span>OS</span></a><nav aria-label="Dashboard navigation"><a className="selected" href="#overview">▦ Overview</a><a href="#activity">⌁ Activity</a><a href="#session">◷ Sessions</a></nav><p className="connection"><i /> Analytics API connected</p></aside>
    <main id="top"><header className="topbar"><div><p className="eyebrow">Phone Behavior Analytics</p><h1>Usage overview</h1></div><div className="live"><i /> Live data <button type="button" className={"theme-toggle " + (sparkle ? "sparkling" : "")} onClick={toggleTheme} aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"}><span className="theme-sun"><SunIcon /></span><span className="theme-moon"><MoonIcon /></span>{[0, 1, 2, 3, 4, 5].map((star) => <em key={star} className={"spark star-" + star}>✦</em>)}</button><b>CY</b></div></header>
      <section className="filters" aria-labelledby="filter-title"><div className="filter-intro"><p className="eyebrow">Explore activity</p><h2 id="filter-title">Refine your view</h2><p>Compare usage patterns and sessions.</p></div><form onSubmit={submit}>
        <FilterMenu loading={optionsLoading} fields={[
          { item: "Device", value: filters.deviceId, placeholder: "Choose a device", tooltip: "Select a device", options: filterOptions.deviceIds, onChange: (value) => update("deviceId", value) },
          { item: "App", value: filters.app, placeholder: "Choose an app", tooltip: "Select an app", options: filterOptions.apps, icons: filterOptions.appIcons, onChange: (value) => update("app", value) }
        ]} />
        <RefreshButton status={refreshStatus} />
      </form></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section id="overview" className="overview-row" aria-label="Usage summary">
        <article className="panel report report-card"><div className="report-head"><p className="eyebrow">Current report</p><h2>{filters.app && <AppIcon app={filters.app} url={filterOptions.appIcons[filters.app]} size={30} />}{filters.app || "Select an app"}</h2><p>{filters.deviceId || "Select a device to load usage data"}</p></div>
          {rank && <div className={"rank rank-" + (rank.position + 1)} aria-label={`${rank.entry.app} is this week's ${RANKS[rank.position].toLowerCase()}`}><span className="rank-badge">{rank.position + 1}</span><span className="rank-text"><small>{RANKS[rank.position]}</small><strong><AppIcon app={rank.entry.app} url={rank.entry.iconUrl} size={18} />{rank.entry.app}</strong></span><em>{duration(rank.entry.usageMilliseconds)}</em></div>}
          <div className="report-range"><span>Range</span><strong>{rangeLabel}</strong></div></article>
        <div className="metrics"><Metric label="Total Time Tracked" value={data ? duration(total) : "—"} detail={data ? rangeLabel : "Load a report to begin"} icon="◷"><div className="metric-secondary"><p>Time Tracked [ past week ]</p><strong>{data ? duration(data.pastWeekMilliseconds) : "—"}</strong></div></Metric><Metric id="session" label="Longest Session [ past week ]" value={data ? duration(data.longestSession?.durationMilliseconds) : "—"} detail={data?.longestSession ? undefined : data ? "No session this week" : "Awaiting activity"} icon="▣" tone="amber">{data?.longestSession && <dl><div><dt>Opened At</dt><dd>{time(data.longestSession.openedAt)}</dd></div><div><dt>Closed At</dt><dd>{time(data.longestSession.closedAt)}</dd></div></dl>}</Metric></div>
      </section>
      <section id="activity" className="activity"><article className="panel trend-panel"><header><div><p className="eyebrow">Usage rollup</p><h2>Time in {filters.app || "your apps"}</h2></div><div className="rollup-controls"><DateRangeChip from={filters.from} to={filters.to} earliestUsageAt={filterOptions.earliestUsageAt} availableDates={filterOptions.availableDates} onChange={(from, to) => setFilters((current) => ({ ...current, from, to }))} /><GranularitySelect value={filters.granularity} onChange={(value) => update("granularity", value)} /></div></header>{data ? <Trend data={data.rollups} granularity={filters.granularity} /> : <div className="chart-empty">Your usage trend will appear here after you load a report.</div>}</article>
</section>

    </main></div></TooltipProvider>;
}
export default App;
