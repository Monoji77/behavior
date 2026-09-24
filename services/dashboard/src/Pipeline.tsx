import { Fragment, useState } from "react";

type LayerKind = "phone" | "api" | "broker" | "processor" | "database" | "dashboard";
type PipelineStep = { id: string; label: string; title: string; detail: string; event: string; kind: LayerKind };

const steps: PipelineStep[] = [
  { id: "capture", label: "Capture", title: "iPhone Shortcut", detail: "An automation records an OPEN or CLOSE event with the app, device, and timestamp.", event: "OPEN · CLOSE", kind: "phone" },
  { id: "ingest", label: "Validate", title: "Ingestion API", detail: "The API authenticates the collector and validates the versioned event contract before accepting it.", event: "authenticated JSON", kind: "api" },
  { id: "stream", label: "Buffer", title: "Kafka", detail: "Kafka keeps events durable and preserves their order for each device while downstream processing catches up.", event: "device-keyed event", kind: "broker" },
  { id: "transform", label: "Transform", title: "Stream processor", detail: "The processor safely writes source events, joins app opens and closes into sessions, and builds time rollups.", event: "session · rollup", kind: "processor" },
  { id: "store", label: "Store", title: "TimescaleDB", detail: "The database retains raw events, completed sessions, and usage rollups as the traceable source behind every metric.", event: "raw · derived data", kind: "database" },
  { id: "serve", label: "Serve", title: "Analytics API", detail: "The API reads the derived data and returns the usage report, trend, and session metrics requested by the dashboard.", event: "dashboard metrics", kind: "api" },
  { id: "dashboard", label: "See", title: "Your dashboard", detail: "The report turns the processed events into the usage patterns, sessions, and trends you are exploring now.", event: "your insights", kind: "dashboard" }
];

function LayerGlyph({ kind }: { kind: LayerKind }) {
  if (kind === "phone") return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="4" width="22" height="40" rx="4" /><path d="M20 9h8M21 38h6" /><path d="m19 24 3 3 7-7" /></svg>;
  if (kind === "api") return <svg viewBox="0 0 48 48" aria-hidden="true"><path d="m18 14-8 10 8 10M30 14l8 10-8 10M27 11l-6 26" /><path d="M6 24h5m26 0h5" /></svg>;
  if (kind === "broker") return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="8" y="9" width="32" height="9" rx="3" /><rect x="8" y="20" width="32" height="9" rx="3" /><rect x="8" y="31" width="32" height="9" rx="3" /><path d="M14 13.5h1m7 0h12M14 24.5h1m7 0h12M14 35.5h1m7 0h12" /></svg>;
  if (kind === "processor") return <svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="13" cy="15" r="4" /><circle cx="35" cy="15" r="4" /><circle cx="24" cy="34" r="4" /><path d="m17 16h13m-15 3 7 11m11-11-7 11" /><path d="m27 29-3 5-3-5" /></svg>;
  if (kind === "database") return <svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="24" cy="11" rx="15" ry="6" /><path d="M9 11v19c0 3.3 6.7 6 15 6s15-2.7 15-6V11" /><path d="M9 21c0 3.3 6.7 6 15 6s15-2.7 15-6" /></svg>;
  return <svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="8" width="36" height="26" rx="3" /><path d="M18 41h12m-6-7v7M12 27l7-7 6 4 9-9" /></svg>;
}

export function Pipeline() {
  const [selectedId, setSelectedId] = useState(steps[0].id);
  const selected = steps.find((step) => step.id === selectedId) ?? steps[0];

  return <section id="pipeline" className="pipeline-page" aria-labelledby="pipeline-title">
    <header className="pipeline-intro">
      <p className="eyebrow">Live data journey</p>
      <h2 id="pipeline-title">From a phone event to the dashboard</h2>
      <p>Follow the animated event through each stage. Select a stage to see exactly what it contributes.</p>
    </header>

    <section className="pipeline-journey" aria-label="Usage data pipeline">
      {steps.map((step, index) => <Fragment key={step.id}>
        <button type="button" className={`pipeline-node pipeline-node--${step.kind} ${selectedId === step.id ? "is-selected" : ""}`} aria-pressed={selectedId === step.id} onClick={() => setSelectedId(step.id)}>
          <span className="pipeline-node__visual" aria-hidden="true"><LayerGlyph kind={step.kind} /></span>
          <span className="pipeline-node__label">{step.label}</span>
          <strong>{step.title}</strong>
          <small>{step.event}</small>
        </button>
        {index < steps.length - 1 && <span className="pipeline-connector" aria-hidden="true"><i /></span>}
      </Fragment>)}
    </section>

    <section className="pipeline-inspector" aria-live="polite" aria-label="Selected pipeline stage">
      <span className="pipeline-inspector__number">{String(steps.indexOf(selected) + 1).padStart(2, "0")}</span>
      <div><p className="eyebrow">{selected.label}</p><h2>{selected.title}</h2><p>{selected.detail}</p></div>
      <span className="pipeline-inspector__event">{selected.event}</span>
    </section>

    <aside className="pipeline-dlq" aria-label="Failure handling">
      <span className="pipeline-dlq__path" aria-hidden="true"><i /></span>
      <span className="pipeline-dlq__icon" aria-hidden="true">!</span>
      <div><p className="eyebrow">Safe failure path</p><h2>Dead-letter topic</h2><p>Events that cannot be processed are retained for inspection instead of being silently lost. Valid events keep flowing to the dashboard.</p></div>
    </aside>
  </section>;
}
