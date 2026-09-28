import { AppIcon } from "./AppIcon";
import { type RecentActivity as Activity } from "./api";
import { formatDuration } from "./format";
import "./RecentActivity.css";

const timestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "medium"
}).format(new Date(value));

export function RecentActivity({ activity, loading, deviceSelected }: {
  activity: Activity | null | undefined;
  loading: boolean;
  deviceSelected: boolean;
}) {
  const active = activity?.status === "ACTIVE";
  return <section className={`panel recent-activity${active ? " recent-activity--active" : ""}`} aria-label="Most recent activity">
    <header><p className="eyebrow">Most recent activity</p>{activity && <span className={`recent-activity__status${active ? " is-active" : ""}`}><i aria-hidden="true" />{active ? "Active now" : "Session closed"}</span>}</header>
    {!activity ? <p className="recent-activity__empty">{!deviceSelected ? "Choose a device to see recent activity." : loading ? "Loading recent activity…" : "No active or closed sessions recorded yet."}</p> : <div className="recent-activity__body" aria-live="polite" aria-atomic="true">
      <div className="recent-activity__app"><AppIcon app={activity.app} url={activity.iconUrl} size={44} /><div><h2>{activity.app}</h2><small>{activity.deviceId}</small></div></div>
      <dl>
        {active ? <div><dt>Opened at</dt><dd><time dateTime={activity.openedAt}>{timestamp(activity.openedAt)}</time></dd></div> : <>
          <div><dt>Usage time</dt><dd className="recent-activity__duration">{activity.durationMilliseconds === 0 ? "0 s" : formatDuration(activity.durationMilliseconds)}</dd></div>
          <div><dt>Closed at</dt><dd>{activity.closedAt && <time dateTime={activity.closedAt}>{timestamp(activity.closedAt)}</time>}</dd></div>
        </>}
      </dl>
    </div>}
  </section>;
}
