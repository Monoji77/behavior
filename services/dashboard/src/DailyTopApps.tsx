import { AppIcon } from "./AppIcon";
import { type TopApp } from "./api";
import { formatDuration } from "./format";
import "./DailyTopApps.css";

export function DailyTopApps({ apps, onSelect }: { apps: TopApp[] | undefined; onSelect: (app: string) => void }) {
  const leaders = apps?.slice(0, 3);
  return <section className="panel daily-top-apps" aria-label="Today's top three apps">
    <header><div><p className="eyebrow">Most used today</p><h2>Top 3 apps</h2></div><span className="pill">Today</span></header>
    {!leaders ? <p className="chart-empty">Choose a device to see today's top apps.</p> : !leaders.length ? <p className="chart-empty">No completed usage recorded today.</p> : <>
      <ol className="app-podium" data-count={leaders.length}>
        {leaders.map((app, index) => <li key={app.app} className={`app-podium__place app-podium__place--${index + 1}`}>
          <button type="button" className="app-podium__button" onClick={() => onSelect(app.app)}
            aria-label={`Rank ${index + 1}: ${app.app}, ${formatDuration(app.usageMilliseconds)} today. Open app summary.`}>
            <span className="app-podium__identity">
              {index === 0 && <svg className="app-podium__crown" viewBox="0 0 32 24" aria-hidden="true"><path d="m3 7 7 5 6-9 6 9 7-5-3 14H6Z" /><path d="M7 17h18" /></svg>}
              <span className="app-podium__icon"><AppIcon app={app.app} url={app.iconUrl} size={52} /></span>
              <strong>{app.app}</strong><span className="app-podium__usage">{formatDuration(app.usageMilliseconds)}</span>
            </span>
            <span className="app-podium__pedestal" aria-hidden="true"><span className="app-podium__number">{index + 1}</span><span className="app-podium__action">Explore <span>↗</span></span></span>
          </button>
        </li>)}
      </ol>
      <p className="app-podium__hint">Select a pedestal to explore that app.</p>
    </>}
  </section>;
}
