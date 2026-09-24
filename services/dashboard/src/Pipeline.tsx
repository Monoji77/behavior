import { type ReactNode, useCallback, useLayoutEffect, useRef, useState } from "react";
import { ApiCloudArt, DashboardArt, DatabaseArt, KafkaArt, PhoneArt, WorkerArt } from "./PipelineArt";

type LayerKind = "phone" | "api" | "broker" | "processor" | "database" | "dashboard";
type Tier = "source" | "backend" | "database" | "client";
type PipelineStep = { id: string; label: string; title: string; detail: string; event: string; kind: LayerKind; tier: Tier; lane?: "write" | "read" };

// Flow order: numbered 1-7 on the diagram.
const steps: PipelineStep[] = [
  { id: "capture", label: "Capture", title: "iPhone Shortcut", detail: "An automation records an OPEN or CLOSE event with the app, device, and timestamp.", event: "OPEN · CLOSE", kind: "phone", tier: "source" },
  { id: "ingest", label: "Validate", title: "Ingestion API", detail: "A Spring Boot HTTP API that your Shortcut calls. It checks the collector token, validates the versioned event contract, and publishes the event to Kafka.", event: "authenticated JSON", kind: "api", tier: "backend", lane: "write" },
  { id: "stream", label: "Buffer", title: "Kafka", detail: "Kafka keeps every event durable in a partitioned log, keyed by device so each phone's events stay in order while processing catches up.", event: "device-keyed event", kind: "broker", tier: "backend", lane: "write" },
  { id: "transform", label: "Transform", title: "Stream processor", detail: "A Spring Boot background worker with no HTTP API: nothing calls it. It pulls events from Kafka, pairs opens and closes into sessions in plain Java, and writes events, sessions and time rollups to TimescaleDB.", event: "session · rollup", kind: "processor", tier: "backend", lane: "write" },
  { id: "store", label: "Store", title: "TimescaleDB", detail: "The database retains raw events, completed sessions, and usage rollups as the traceable source behind every metric.", event: "raw · derived data", kind: "database", tier: "database" },
  { id: "serve", label: "Serve", title: "Analytics API", detail: "A Spring Boot HTTP API that the dashboard calls. It reads sessions and rollups from TimescaleDB and returns the report, trend and session metrics.", event: "dashboard metrics", kind: "api", tier: "backend", lane: "read" },
  { id: "dashboard", label: "See", title: "Your dashboard", detail: "The report turns the processed events into the usage patterns, sessions, and trends you are exploring now.", event: "your insights", kind: "dashboard", tier: "client" }
];

const tiers: Record<Tier, { name: string; role: string }> = {
  source: { name: "Source", role: "Where events originate" },
  backend: { name: "Backend", role: "Services that ingest, process and serve" },
  database: { name: "Database", role: "Durable storage" },
  client: { name: "Client", role: "Frontend" }
};

const tierLabel = (step: PipelineStep) => tiers[step.tier].name + (step.lane ? ` · ${step.lane} path` : "");

const art: Record<string, ReactNode> = {
  capture: <PhoneArt />,
  ingest: <ApiCloudArt variant="ingest" />,
  stream: <KafkaArt />,
  transform: <WorkerArt />,
  store: <DatabaseArt />,
  serve: <ApiCloudArt variant="serve" />,
  dashboard: <DashboardArt />
};

function Node({ step, selectedId, onSelect, register }: { step: PipelineStep; selectedId: string; onSelect: (id: string) => void; register: (id: string, element: HTMLElement | null) => void }) {
  return <button type="button" className={`pipeline-node pipeline-node--${step.kind} arch-node arch-node--${step.tier} ${selectedId === step.id ? "is-selected" : ""}`} aria-pressed={selectedId === step.id} onClick={() => onSelect(step.id)}>
    <span className="arch-node__step" aria-label={`Step ${steps.indexOf(step) + 1}`}>{steps.indexOf(step) + 1}</span>
    <span className="pipeline-node__visual" ref={(element) => register(step.id, element)} aria-hidden="true">{art[step.id]}</span>
    <span className="pipeline-node__label">{step.label}</span>
    <strong>{step.title}</strong>
    <small>{step.event}</small>
  </button>;
}

function GroupHeader({ tier, lane, role }: { tier: Tier; lane?: string; role?: string }) {
  return <header className="arch-group__header"><span>{tiers[tier].name}{lane && <em> · {lane}</em>}</span><small>{role ?? tiers[tier].role}</small></header>;
}

type Wire = { from: string; to: string; d: string; start: [number, number]; end: [number, number] };
const flow = steps.slice(1).map((step, index) => ({ from: steps[index].id, to: step.id }));

// A curve from one illustration's edge to the next: horizontal between neighbours
// in a row, vertical between tiers. Recomputed from the live layout.
// a/b are the illustrations (curves line up with them); nodeA/nodeB are the whole
// stages, so vertical curves leave below and enter above the labels.
function curve(a: DOMRect, b: DOMRect, nodeA: DOMRect, nodeB: DOMRect): Pick<Wire, "d" | "start" | "end"> {
  const ay = a.top + a.height / 2, by = b.top + b.height / 2;
  if (Math.abs(by - ay) < Math.min(a.height, b.height) * 0.5) {
    const start: [number, number] = [a.right, ay], end: [number, number] = [b.left, by];
    const k = Math.abs(end[0] - start[0]) * 0.5;
    return { start, end, d: `M${start} C${start[0] + k},${start[1]} ${end[0] - k},${end[1]} ${end}` };
  }
  const down = by > ay;
  const start: [number, number] = [a.left + a.width / 2, down ? nodeA.bottom : nodeA.top];
  const end: [number, number] = [b.left + b.width / 2, down ? nodeB.top : nodeB.bottom];
  const k = Math.abs(end[1] - start[1]) * 0.55 * (down ? 1 : -1);
  return { start, end, d: `M${start} C${start[0]},${start[1] + k} ${end[0]},${end[1] - k} ${end}` };
}

function Wires({ wires, selectedId }: { wires: Wire[]; selectedId: string }) {
  const tierOf = (id: string) => steps.find((step) => step.id === id)!.tier;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const cycle = wires.length * 1.3;
  return <svg className="arch-wires" aria-hidden="true">
    <defs>
      {(["source", "backend", "database", "client"] as Tier[]).map((tier) => <marker key={tier} id={`wire-head-${tier}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L9,5 L0,9 Z" style={{ fill: `var(--tier-${tier})` }} /></marker>)}
      {wires.map((wire, index) => <linearGradient key={index} id={`wire-paint-${index}`} gradientUnits="userSpaceOnUse" x1={wire.start[0]} y1={wire.start[1]} x2={wire.end[0]} y2={wire.end[1]}>
        <stop offset="0" style={{ stopColor: `var(--tier-${tierOf(wire.from)})` }} />
        <stop offset="1" style={{ stopColor: `var(--tier-${tierOf(wire.to)})` }} />
      </linearGradient>)}
    </defs>
    {wires.map((wire, index) => <path key={index} id={`wire-${index}`} d={wire.d} className={`arch-wire ${[wire.from, wire.to].includes(selectedId) ? "is-active" : ""}`} stroke={`url(#wire-paint-${index})`} markerEnd={`url(#wire-head-${tierOf(wire.to)})`} />)}
    {!reduceMotion && wires.map((wire, index) => {
      // One event travels the whole chain: each wire's dot runs only during its slot.
      const [from, to] = [index / wires.length, (index + 1) / wires.length];
      return <circle key={`dot-${index}`} className="arch-dot" r="4" style={{ fill: `var(--tier-${tierOf(wire.to)})` }}>
        <animateMotion dur={`${cycle}s`} repeatCount="indefinite" calcMode="linear" keyPoints="0;0;1;1" keyTimes={`0;${from};${to};1`}><mpath href={`#wire-${index}`} /></animateMotion>
        <animate attributeName="opacity" dur={`${cycle}s`} repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes={`0;${from};${from + 0.001};${Math.max(from + 0.002, to - 0.001)};${to};1`} />
      </circle>;
    })}
  </svg>;
}

export function Pipeline() {
  const [selectedId, setSelectedId] = useState(steps[0].id);
  const selected = steps.find((step) => step.id === selectedId) ?? steps[0];
  const step = (id: string) => steps.find((candidate) => candidate.id === id)!;
  const archRef = useRef<HTMLElement>(null);
  const visuals = useRef(new Map<string, HTMLElement>());
  const [wires, setWires] = useState<Wire[]>([]);
  const register = useCallback((id: string, element: HTMLElement | null) => { if (element) visuals.current.set(id, element); else visuals.current.delete(id); }, []);
  const node = (id: string) => <Node step={step(id)} selectedId={selectedId} onSelect={setSelectedId} register={register} />;

  useLayoutEffect(() => {
    const arch = archRef.current;
    if (!arch) return;
    const measure = () => {
      const base = arch.getBoundingClientRect();
      const relative = (r: DOMRect) => new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height);
      const rect = (id: string) => relative(visuals.current.get(id)!.getBoundingClientRect());
      const nodeRect = (id: string) => relative((visuals.current.get(id)!.closest(".arch-node") ?? visuals.current.get(id)!).getBoundingClientRect());
      setWires(flow.filter(({ from, to }) => visuals.current.has(from) && visuals.current.has(to)).map(({ from, to }) => ({ from, to, ...curve(rect(from), rect(to), nodeRect(from), nodeRect(to)) })));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(arch);
    return () => observer.disconnect();
  }, []);

  return <section id="pipeline" className="pipeline-page" aria-labelledby="pipeline-title">
    <header className="pipeline-intro">
      <p className="eyebrow">Live data journey</p>
      <h2 id="pipeline-title">From a phone event to the dashboard</h2>
      <p>Events travel from the source through the backend into the database, then back out through the backend to the client. Select a stage to see exactly what it contributes.</p>
    </header>

    <section className="arch" ref={archRef} aria-label="Usage data architecture">
      <Wires wires={wires} selectedId={selectedId} />
      <section className="arch-group arch-group--source" style={{ gridArea: "source" }} aria-label="Source"><GroupHeader tier="source" />{node("capture")}</section>
      <section className="arch-group arch-group--client" style={{ gridArea: "client" }} aria-label="Client"><GroupHeader tier="client" />{node("dashboard")}</section>
      <section className="arch-group arch-group--backend" aria-label="Backend">
        <GroupHeader tier="backend" />
        <div className="arch-lane arch-lane--write" aria-label="Backend write path">
          <span className="arch-lane__label">Write path</span>
          <GroupHeader tier="backend" lane="write path" role="Ingest and process events" />
          {node("ingest")}{node("stream")}{node("transform")}
        </div>
        <div className="arch-lane arch-lane--read" aria-label="Backend read path">
          <span className="arch-lane__label">Read path</span>
          <GroupHeader tier="backend" lane="read path" role="Serve metrics to the client" />
          {node("serve")}
        </div>
      </section>
      <section className="arch-group arch-group--database" style={{ gridArea: "database" }} aria-label="Database"><GroupHeader tier="database" />{node("store")}</section>
    </section>

    <section className="pipeline-inspector" aria-live="polite" aria-label="Selected pipeline stage">
      <span className="pipeline-inspector__number">{String(steps.indexOf(selected) + 1).padStart(2, "0")}</span>
      <div><p className="eyebrow">{tierLabel(selected)} · {selected.label}</p><h2>{selected.title}</h2><p>{selected.detail}</p></div>
      <span className="pipeline-inspector__event">{selected.event}</span>
    </section>

    <aside className="pipeline-dlq" aria-label="Failure handling">
      <span className="pipeline-dlq__path" aria-hidden="true"><i /></span>
      <span className="pipeline-dlq__icon" aria-hidden="true">!</span>
      <div><p className="eyebrow">Safe failure path · Backend</p><h2>Dead-letter topic</h2><p>Events the stream processor cannot handle are parked in a Kafka dead-letter topic for inspection instead of being silently lost. Valid events keep flowing to the dashboard.</p></div>
    </aside>
  </section>;
}
