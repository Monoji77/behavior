import { Fragment, useState } from "react";

type PipelineStep = {
  id: string;
  label: string;
  title: string;
  detail: string;
  event: string;
  icon: string;
};

const steps: PipelineStep[] = [
  { id: "capture", label: "Capture", title: "iPhone Shortcut", detail: "An automation records an OPEN or CLOSE event with the app, device, and timestamp.", event: "OPEN · CLOSE", icon: "⌁" },
  { id: "ingest", label: "Validate", title: "Ingestion API", detail: "The API authenticates the collector and validates the versioned event contract before accepting it.", event: "authenticated JSON", icon: "✓" },
  { id: "stream", label: "Buffer", title: "Kafka", detail: "Kafka keeps events durable and preserves their order for each device while downstream processing catches up.", event: "device-keyed event", icon: "≈" },
  { id: "transform", label: "Transform", title: "Stream processor", detail: "The processor safely writes source events, joins app opens and closes into sessions, and builds time rollups.", event: "session · rollup", icon: "⌘" },
  { id: "store", label: "Store", title: "TimescaleDB", detail: "The database retains raw events, completed sessions, and usage rollups as the traceable source behind every metric.", event: "raw · derived data", icon: "▤" },
  { id: "serve", label: "Serve", title: "Analytics API", detail: "The API reads the derived data and returns the usage report, trend, and session metrics requested by the dashboard.", event: "dashboard metrics", icon: "↗" },
  { id: "dashboard", label: "See", title: "Your dashboard", detail: "The report turns the processed events into the usage patterns, sessions, and trends you are exploring now.", event: "your insights", icon: "▦" }
];

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
        <button type="button" className={"pipeline-node " + (selectedId === step.id ? "is-selected" : "")} aria-pressed={selectedId === step.id} onClick={() => setSelectedId(step.id)}>
          <span className="pipeline-node__orb" aria-hidden="true"><span>{step.icon}</span></span>
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
