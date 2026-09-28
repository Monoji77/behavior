import { type StoredPipelineEvent } from "./api";
import { AppIcon } from "./AppIcon";

const timestamp = (value: string) => new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }).format(new Date(value));

export function PipelineActivity({ events, error }: { events: StoredPipelineEvent[] | null; error: string | null }) {
  return <section className="panel pipeline-activity" aria-label="Latest stored events">
    <header><div><p className="eyebrow">Recent activity</p><h2>Latest stored events</h2><p>OPEN and CLOSE events saved to the database, newest first.</p></div><span className="pill">Auto updates</span></header>
    {error && <p className="error" role="status">{error} Retrying automatically.</p>}
    {events == null ? <p className="chart-empty">Loading recent activity…</p> : !events.length ? <p className="chart-empty">No stored activity yet.</p> : <div className="pipeline-activity__scroll"><table>
      <thead><tr><th scope="col">Event</th><th scope="col">App</th><th scope="col">Occurred</th><th scope="col">Stored</th></tr></thead>
      <tbody>{events.map((event) => <tr key={`${event.eventId}:${event.at}`}>
        <td><span className={`event-kind event-kind--${event.kind.toLowerCase()}`}>{event.kind}</span></td>
        <td><span className="pipeline-activity__app">{event.app && <AppIcon app={event.app} url={event.iconUrl} size={24} />}<span>{event.app ?? (event.closedApps.length ? event.closedApps.join(", ") : event.deviceId ? "Device close" : "App activity")}<small>{event.deviceId ?? "Phone activity"}</small></span></span></td>
        <td><time dateTime={event.at}>{timestamp(event.at)}</time></td>
        <td><time dateTime={event.storedAt}>{timestamp(event.storedAt)}</time><small>Saved</small></td>
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
