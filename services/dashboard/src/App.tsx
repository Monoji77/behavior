import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Area, AreaChart, CartesianGrid, type TooltipContentProps, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppIcon } from "./AppIcon";
import { formatDuration } from "./format";
import { FilterMenu } from "./FilterMenu";
import { LinkPreview } from "./LinkPreview";
import { type DashboardData, type Filters, type Granularity, type FilterOptions, DashboardApiError, appsWithTopFirst, defaultDateRange, defaultSelection, fillUsageBuckets, loadDashboard, loadFilterOptions, selectedAppRank } from "./api";
import { DateRangeChip } from "./DateRangeChip";
import { GranularitySelect } from "./GranularitySelect";
import { RefreshButton, type RefreshStatus } from "./RefreshButton";
import { Pipeline } from "./Pipeline";

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
const duration = formatDuration;
const time = (value?: string | null) => value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const dayFromDateTime = (value: string) => value.slice(0, 10);
const formatDay = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dayFromDateTime(value) + "T12:00:00"));

function SunIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.7" /><path d="M12 2v2.1M12 19.9V22M4.93 4.93l1.49 1.49M17.58 17.58l1.49 1.49M2 12h2.1M19.9 12H22M4.93 19.07l1.49-1.49M17.58 6.42l1.49-1.49" /></svg>; }
function MoonIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.7 15.1A8.6 8.6 0 0 1 8.9 3.3 8.7 8.7 0 1 0 20.7 15.1Z" /></svg>; }
function HomeIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10.7 8.5-7 8.5 7v9.1a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7Z" /><path d="M9.2 21.5v-6.3h5.6v6.3" /></svg>; }
function PipelineIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="6" r="2" /><circle cx="19" cy="6" r="2" /><circle cx="12" cy="18" r="2" /><path d="M7 6h10M5 8v5.2a2 2 0 0 0 2 2h3M19 8v5.2a2 2 0 0 1-2 2h-3" /></svg>; }

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

function Trend({ rollups, from, to, granularity }: { rollups: DashboardData["rollups"]; from: string; to: string; granularity: Granularity }) {
  if (!rollups.length) return <div className="chart-empty">No activity was recorded for this range.</div>;
  const data = fillUsageBuckets(rollups, from, to, granularity);
  const max = Math.max(...data.map(({ usageMilliseconds }) => usageMilliseconds), 1);
  // Whole-minute ticks (0, 1, 2… or 0, 10, 20…) so small peaks don't read "0 min" several times.
  // Short usage gets a seconds axis; otherwise minutes.
  const unit = max < 120_000 ? 1_000 : 60_000;
  const maxUnits = Math.max(1, Math.ceil(max / unit));
  const tickStep = Math.max(1, Math.ceil(maxUnits / 4));
  const yTicks = Array.from({ length: Math.ceil(maxUnits / tickStep) + 1 }, (_, index) => index * tickStep * unit);
  return <div className="trend-wrap">
    <ChartContainer config={trendConfig} className="chart-touch-target aspect-auto h-[260px] w-full">
      <AreaChart data={data} margin={{ top: 16, right: 16, left: 0, bottom: 8 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-usage)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-usage)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
        <XAxis dataKey="bucketStart" tickLine={false} axisLine={false} tickMargin={10} minTickGap={40} tick={{ fill: "var(--faint)", fontSize: 11 }} tickFormatter={(value: string) => axisLabel(value, granularity)} />
        <YAxis ticks={yTicks} domain={[0, yTicks[yTicks.length - 1]]} tickLine={false} axisLine={false} width={52} tick={{ fill: "var(--faint)", fontSize: 11 }} tickFormatter={(value: number) => Math.round(value / unit) + (unit === 1_000 ? " s" : " min")} />
        <ChartTooltip cursor={{ stroke: "var(--color-usage)", strokeDasharray: "3 3" }} content={<TrendTooltip granularity={granularity} />} />
        <Area dataKey="usageMilliseconds" type="monotone" fill="url(#trendFill)" stroke="var(--color-usage)" strokeWidth={3} dot={(props: { cx?: number; cy?: number; index?: number; payload?: { usageMilliseconds: number } }) => props.payload?.usageMilliseconds ? <circle key={props.index} cx={props.cx} cy={props.cy} r={3} fill="var(--panel)" stroke="var(--color-usage)" strokeWidth={2} /> : <g key={props.index} />} activeDot={{ r: 5, fill: "var(--color-usage)", stroke: "var(--panel)", strokeWidth: 2 }} />
      </AreaChart>
    </ChartContainer>
    <div className="chart-key"><span><i /> Usage time</span><span>Peak: {duration(max)}</span></div>
  </div>;
}

function App() {
  const [filters, setFilters] = useState<Filters>({ deviceId: "", app: "", granularity: "HOUR", ...initialRange });
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus>("idle");
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ deviceIds: [], apps: [], earliestUsageAt: null, availableDates: [], topApp: null, appIcons: {} });
  const [optionsLoading, setOptionsLoading] = useState(true);
  // Desktop sidebar can collapse to an icon rail; remembered per browser.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem("behavior-sidebar") === "collapsed"; } catch { return false; } });
  const toggleSidebar = () => setSidebarCollapsed((current) => { try { localStorage.setItem("behavior-sidebar", current ? "expanded" : "collapsed"); } catch { /* storage unavailable */ } return !current; });
  const [theme, setTheme] = useState<"dark" | "light">(() => localStorage.getItem("behavior-theme") === "light" ? "light" : "dark");
  const [sparkle, setSparkle] = useState(false);
  // Pipeline is the landing page; the dashboard lives at #overview.
  const [page, setPage] = useState<"overview" | "pipeline">(() => window.location.hash === "#overview" ? "overview" : "pipeline");
  // Device|app whose default date range has been applied; the report waits for it.
  const [rangeKey, setRangeKey] = useState("");
  const hasAppliedDefaultSelection = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  const rank = selectedAppRank(data?.topApps, filters.app);
  const appRanks = Object.fromEntries((data?.topApps ?? []).slice(0, 3).map((entry, index) => [entry.app, ["1st", "2nd", "3rd"][index]]));
  const rangeLabel = dayFromDateTime(filters.from) === dayFromDateTime(filters.to) ? formatDay(filters.from) : formatDay(filters.from) + " – " + formatDay(filters.to);
  const total = useMemo(() => data?.rollups.reduce((sum, item) => sum + item.usageMilliseconds, 0) ?? 0, [data]);
  const update = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((current) => ({ ...current, [key]: value }));

  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("behavior-theme", theme); }, [theme]);
  useEffect(() => {
    const updatePage = () => setPage(window.location.hash === "#overview" ? "overview" : "pipeline");
    window.addEventListener("hashchange", updatePage);
    return () => window.removeEventListener("hashchange", updatePage);
  }, []);
  useEffect(() => {
    if (page === "pipeline") { setOptionsLoading(false); return; }
    let cancelled = false;
    const selectionKey = filters.deviceId + "|" + filters.app;
    setRangeKey("");
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
        // Every device/app selection starts on its own recent data (see defaultDateRange).
        if (filters.deviceId && filters.app) {
          const range = defaultDateRange(options.availableDates);
          if (range) setFilters((current) => ({ ...current, ...range }));
          setRangeKey(selectionKey);
        }
      })
      // Keep the last good lists on failure (e.g. a 429 while switching quickly); emptying
      // them would make the effect below clear the selected app. Load with the current range.
      .catch(() => { if (!cancelled) setRangeKey(selectionKey); })
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [filters.deviceId, filters.app, page]);
  useEffect(() => {
    if (!optionsLoading && filters.app && !filterOptions.apps.includes(filters.app)) {
      update("app", "");
    }
  }, [optionsLoading, filterOptions.apps, filters.app]);
  useEffect(() => {
    // Wait for this selection's date range, so a switch costs one dashboard request.
    if (page === "overview" && filters.deviceId && filters.app && rangeKey === filters.deviceId + "|" + filters.app) {
      submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.deviceId, filters.app, filters.from, filters.to, filters.granularity, page, rangeKey]);
  function toggleTheme() { setSparkle(true); setTheme((current) => current === "dark" ? "light" : "dark"); window.setTimeout(() => setSparkle(false), 520); }
  async function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    // The inputs' `required` only sees typed text, not a chosen option; never query with nothing selected.
    if (!filters.deviceId || !filters.app) { setData(null); setError("Choose a device and an app from the list."); return; }
    // Only the latest selection may update the page; cancel whatever it supersedes.
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setRefreshStatus("loading"); setError(null);
    try {
      const next = await loadDashboard(filters, controller.signal);
      if (controller.signal.aborted) return;
      setData(next);
      setRefreshStatus("done");
    } catch (reason) {
      if (controller.signal.aborted) return;
      if (reason instanceof DashboardApiError && reason.status === 429) {
        // Keep showing the previous report rather than wiping the page.
        setError("Too many requests. Wait a few seconds, then refresh.");
      } else {
        setData(null); setError(reason instanceof Error ? reason.message : "Unable to load metrics.");
      }
      setRefreshStatus("error");
    } finally {
      if (loadController.current === controller) window.setTimeout(() => setRefreshStatus("idle"), 1400);
    }
  }

  return <TooltipProvider delay={150}><div className={`shell ${sidebarCollapsed ? "is-sidebar-collapsed" : ""}`}>
    <aside className="sidebar"><button type="button" className="brand" onClick={toggleSidebar} aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3 12h3.5l2.2-5.5 4.1 11 2.6-7.2 1.4 1.7H21" /></svg></span><span className="brand-text"><strong>Digital Habits</strong><small>by Chris Yong</small></span></button><nav aria-label="Dashboard navigation"><a className={page === "pipeline" ? "selected" : ""} href="#pipeline" title="Pipeline"><span className="nav-icon" aria-hidden="true">⌘</span><span className="nav-label">Pipeline</span></a><a className={page === "overview" ? "selected" : ""} href="#overview" title="Dashboard"><span className="nav-icon" aria-hidden="true">▦</span><span className="nav-label">Dashboard</span></a></nav><div className="sidebar-links"><LinkPreview image="/previews/github.jpg" title="Monoji77/behavior" address="github.com/Monoji77/behavior"><a className="portfolio-link" href="https://github.com/Monoji77/behavior/tree/main" target="_blank" rel="noopener noreferrer"><svg className="icon-filled" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" /></svg><span className="nav-label">Source on GitHub</span></a></LinkPreview><LinkPreview image="/previews/portfolio.jpg" title="Chris Yong · Portfolio" address="chrisyong-portfolio.com"><a className="portfolio-link" href="https://chrisyong-portfolio.com/" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M14 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg><span className="nav-label">My portfolio</span></a></LinkPreview></div></aside>
    <main id="top"><header className="topbar"><div><p className="eyebrow">Phone Behavior Analytics</p><h1>{page === "pipeline" ? "Data pipeline" : "Usage overview"}</h1></div><div className="live"><i /> Live data <button type="button" className={"theme-toggle " + (sparkle ? "sparkling" : "")} onClick={toggleTheme} aria-label={"Switch to " + (theme === "dark" ? "light" : "dark") + " mode"}><span className="theme-sun"><SunIcon /></span><span className="theme-moon"><MoonIcon /></span>{[0, 1, 2, 3, 4, 5].map((star) => <em key={star} className={"spark star-" + star}>✦</em>)}</button></div></header>
      {page === "pipeline" ? <Pipeline /> : <><section className="filters" aria-label="Filters"><div className="filter-intro"><p className="eyebrow">Explore activity</p><p>Compare usage patterns and sessions.</p></div><form onSubmit={submit}>
        <FilterMenu loading={optionsLoading} fields={[
          { item: "Device", value: filters.deviceId, placeholder: "Choose a device", tooltip: "Select a device", options: filterOptions.deviceIds, onChange: (value) => update("deviceId", value) },
          { item: "App", value: filters.app, placeholder: "Choose an app", tooltip: "Select an app", options: appsWithTopFirst(filterOptions.apps, data?.topApps), icons: filterOptions.appIcons, ranks: appRanks, onChange: (value) => update("app", value) }
        ]} />
        <RefreshButton status={refreshStatus} />
      </form></section>
      {error && <p className="error" role="alert">{error}</p>}
      <section id="overview" className="dashboard-layout" aria-label="Usage summary">
        <article className="panel report report-card"><div className="report-head"><p className="eyebrow">Current report</p><h2>{filters.app && <AppIcon app={filters.app} url={filterOptions.appIcons[filters.app]} size={30} />}{filters.app || "Select an app"}</h2><p>{filters.deviceId || "Select a device to load usage data"}</p></div>
          {rank && <div className={"rank rank-" + (rank.position + 1)} aria-label={`${rank.entry.app} is this week's ${RANKS[rank.position].toLowerCase()}`}><span className="rank-badge">{rank.position + 1}</span><span className="rank-text"><small>{RANKS[rank.position]}</small><strong><AppIcon app={rank.entry.app} url={rank.entry.iconUrl} size={18} />{rank.entry.app}</strong></span><em>{duration(rank.entry.usageMilliseconds)}</em></div>}
          <div className="report-range"><span>Range</span><strong>{rangeLabel}</strong></div></article>
        <section id="activity" className="activity"><article className="panel trend-panel"><header><div><h2 className="trend-title">{filters.app ? <><AppIcon app={filters.app} url={filterOptions.appIcons[filters.app]} size={30} /><span className="sr-only">{filters.app}</span></> : "Select an app"}</h2></div><div className="rollup-controls"><DateRangeChip from={filters.from} to={filters.to} earliestUsageAt={filterOptions.earliestUsageAt} availableDates={filterOptions.availableDates} onChange={(from, to) => setFilters((current) => ({ ...current, from, to }))} /><GranularitySelect value={filters.granularity} onChange={(value) => update("granularity", value)} /></div></header>{data ? <Trend rollups={data.rollups} from={filters.from} to={filters.to} granularity={filters.granularity} /> : <div className="chart-empty">Chris's usage trend will appear here once a report is loaded.</div>}</article></section>
        <div className="metrics"><Metric label="Total Time Tracked" value={data ? duration(total) : "—"} detail={data ? rangeLabel : "Load a report to begin"} icon="◷"><div className="metric-secondary"><p>Time Tracked [ past week ]</p><strong>{data ? duration(data.pastWeekMilliseconds) : "—"}</strong></div></Metric><Metric id="session" label="Longest Session [ past week ]" value={data ? duration(data.longestSession?.durationMilliseconds) : "—"} detail={data?.longestSession ? undefined : data ? "No session this week" : "Awaiting activity"} icon="▣" tone="amber">{data?.longestSession && <dl><div><dt>Opened At</dt><dd>{time(data.longestSession.openedAt)}</dd></div><div><dt>Closed At</dt><dd>{time(data.longestSession.closedAt)}</dd></div></dl>}</Metric></div>
      </section>

      </>}</main>
    <nav className="glass-nav" aria-label="Primary navigation">
      <a className={"glass-nav__link " + (page === "pipeline" ? "is-current" : "")} href="#pipeline" aria-label="Data pipeline">
        <span className="glass-nav__icon"><PipelineIcon /></span>
        <span className="glass-nav__label">Pipeline</span>
      </a>
      <a className={"glass-nav__link " + (page === "overview" ? "is-current" : "")} href="#overview" aria-label="Dashboard">
        <span className="glass-nav__icon"><HomeIcon /></span>
        <span className="glass-nav__label">Dashboard</span>
      </a>
    </nav>
  </div></TooltipProvider>;
}
export default App;
