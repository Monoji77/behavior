import { AppIcon } from "./AppIcon";
import { type CurrentActivity } from "./api";
import { formatDuration } from "./format";

const timestamp = (value: string) => new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium", timeStyle: "medium"
}).format(new Date(value));

export function PipelineSession({ activity, loading }: { activity: CurrentActivity | null; loading: boolean }) {
  if (!activity) return <span className="pipeline-current">{loading ? "Loading activity…" : "No app sessions recorded yet."}</span>;
  const active = activity.status === "ACTIVE";
  return <span className="pipeline-current" aria-label="Current app session">
    <span className="pipeline-current__app">{activity.app && <AppIcon app={activity.app} url={activity.iconUrl} size={22} />}<strong>{activity.app ?? "An app"}</strong></span>
    <span className={`pipeline-current__state${active ? " is-active" : ""}`}>{active ? "Active now" : "Session closed"}</span>
    {active ? <span className="pipeline-current__detail">Opened at <time dateTime={activity.openedAt}>{timestamp(activity.openedAt)}</time></span> : <>
      <span className="pipeline-current__detail">Usage time <strong>{activity.durationMilliseconds === 0 ? "0 s" : formatDuration(activity.durationMilliseconds)}</strong></span>
      <span className="pipeline-current__detail">Closed at {activity.closedAt && <time dateTime={activity.closedAt}>{timestamp(activity.closedAt)}</time>}</span>
    </>}
  </span>;
}
