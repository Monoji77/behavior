import { type ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ApiCloudArt, DashboardArt, DatabaseArt, KafkaArt, PhoneArt, WorkerArt } from "./PipelineArt";
import { AppIcon } from "./AppIcon";
import { type LiveEvent, flyToken, liveEventLabel } from "./liveFlow";

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

// Side branch, not a numbered step: where the stream processor parks events it can't handle.
const deadLetter: PipelineStep = { id: "dlq", label: "Park", title: "Dead-letter topic", detail: "When the stream processor can't handle an event, it retries twice, then publishes it to the Kafka topic app-usage-events.dlq.v1 for inspection instead of losing it. Valid events keep flowing.", event: "failed events", kind: "broker", tier: "backend", lane: "write" };
const stages = [...steps, deadLetter];

const tiers: Record<Tier, { name: string; role: string }> = {
  source: { name: "Source", role: "" },
  backend: { name: "Backend", role: "Services that ingest, process and serve" },
  database: { name: "Database", role: "" },
  client: { name: "Client", role: "" }
};

const tierLabel = (step: PipelineStep) => tiers[step.tier].name + (step.lane ? ` · ${step.lane} path` : "");

const art: Record<string, ReactNode> = {
  capture: <PhoneArt />,
  ingest: <ApiCloudArt variant="ingest" />,
  stream: <KafkaArt />,
  transform: <WorkerArt />,
  store: <DatabaseArt />,
  serve: <ApiCloudArt variant="serve" />,
  dashboard: <DashboardArt />,
  dlq: <KafkaArt />
};

function Node({ step, selectedId, onSelect, register }: { step: PipelineStep; selectedId: string; onSelect: (id: string) => void; register: (id: string, element: HTMLElement | null) => void }) {
  return <button type="button" className={`pipeline-node pipeline-node--${step.kind} arch-node arch-node--${step.tier} arch-node--${step.id} ${selectedId === step.id ? "is-selected" : ""}`} data-step={step.id} aria-pressed={selectedId === step.id} onClick={() => onSelect(step.id)}>
    {steps.includes(step) && <span className="arch-node__step" aria-label={`Step ${steps.indexOf(step) + 1}`}>{steps.indexOf(step) + 1}</span>}
    <span className="pipeline-node__visual" ref={(element) => register(step.id, element)} aria-hidden="true">{art[step.id]}</span>
    <span className="pipeline-node__label">{step.label}</span>
    <strong>{step.title}</strong>
    <small>{step.event}</small>
  </button>;
}

function GroupHeader({ tier, lane, role }: { tier: Tier; lane?: string; role?: string }) {
  return <header className="arch-group__header"><span>{tiers[tier].name}{lane && <em> · {lane}</em>}</span>{(role ?? tiers[tier].role) && <small>{role ?? tiers[tier].role}</small>}</header>;
}

type Wire = { from: string; to: string; d: string; start: [number, number]; end: [number, number] };
const flow = steps.slice(1).map((step, index) => ({ from: steps[index].id, to: step.id }));
const branches = [{ from: "transform", to: "dlq" }];

// A curve from one illustration's edge to the next: horizontal between neighbours
// in a row, vertical between tiers. Recomputed from the live layout.
type Point = [number, number];
type Route = { from: string; to: string; horizontal: boolean; down: boolean; start: Point; end: Point; fromBox: DOMRect; toBox: DOMRect };

// a/b are the illustrations (curves line up with them); nodeA/nodeB are the whole
// stages, so vertical curves leave below and enter above the labels.
function route(from: string, to: string, a: DOMRect, b: DOMRect, nodeA: DOMRect, nodeB: DOMRect): Route {
  const ay = a.top + a.height / 2, by = b.top + b.height / 2;
  const horizontal = Math.abs(by - ay) < Math.min(a.height, b.height) * 0.5;
  const down = by > ay;
  if (horizontal) return { from, to, horizontal, down, start: [a.right, ay], end: [b.left, by], fromBox: a, toBox: b };
  return {
    from, to, horizontal, down, fromBox: a, toBox: b,
    start: [a.left + a.width / 2, down ? nodeA.bottom : nodeA.top],
    end: [b.left + b.width / 2, down ? nodeB.top : nodeB.bottom]
  };
}

// Where several wires meet one edge of a stage (e.g. two on TimescaleDB's top),
// spread their anchors across the edge, ordered by where each wire's other end is.
function spreadSharedAnchors(routes: Route[]) {
  const groups = new Map<string, { route: Route; end: "start" | "end"; otherX: number; box: DOMRect }[]>();
  for (const r of routes) {
    if (r.horizontal) continue;
    const sides: [string, "start" | "end", number, DOMRect][] = [
      [`${r.from}:${r.down ? "bottom" : "top"}`, "start", r.end[0], r.fromBox],
      [`${r.to}:${r.down ? "top" : "bottom"}`, "end", r.start[0], r.toBox]
    ];
    for (const [key, end, otherX, box] of sides) groups.set(key, [...(groups.get(key) ?? []), { route: r, end, otherX, box }]);
  }
  for (const anchors of groups.values()) {
    if (anchors.length < 2) continue;
    anchors.sort((x, y) => x.otherX - y.otherX);
    const spacing = (anchors[0].box.width * 0.36) / (anchors.length - 1);
    anchors.forEach(({ route: r, end, box }, index) => {
      r[end] = [box.left + box.width / 2 + (index - (anchors.length - 1) / 2) * spacing, r[end][1]];
    });
  }
}

// Length of the arrowhead; the line stops at its base so nothing shows past the tip.
const ARROW = 9;

// A side branch drops straight down from its source, then turns into the target's
// nearer side, so it never cuts across the stages it passes.
function branchWire(from: string, to: string, a: DOMRect, b: DOMRect, nodeA: DOMRect): Wire {
  const toLeft = b.left + b.width / 2 < a.left + a.width / 2;
  const start: Point = [a.left + a.width / 2 + (toLeft ? -a.width * 0.18 : a.width * 0.18), nodeA.bottom];
  const end: Point = [toLeft ? b.right : b.left, b.top + b.height / 2];
  const lineEnd: Point = [end[0] + (toLeft ? ARROW : -ARROW), end[1]];
  return { from, to, start, end, d: `M${start} C${start[0]},${end[1]} ${start[0]},${end[1]} ${lineEnd}` };
}

function toWire(r: Route): Wire {
  const { start, end } = r;
  if (r.horizontal) {
    const dir = end[0] >= start[0] ? 1 : -1;
    const lineEnd: Point = [end[0] - dir * ARROW, end[1]];
    const k = Math.abs(lineEnd[0] - start[0]) * 0.5 * dir;
    return { from: r.from, to: r.to, start, end, d: `M${start} C${start[0] + k},${start[1]} ${lineEnd[0] - k},${lineEnd[1]} ${lineEnd}` };
  }
  const dir = r.down ? 1 : -1;
  const lineEnd: Point = [end[0], end[1] - dir * ARROW];
  const k = Math.abs(lineEnd[1] - start[1]) * 0.55 * dir;
  return { from: r.from, to: r.to, start, end, d: `M${start} C${start[0]},${start[1] + k} ${lineEnd[0]},${lineEnd[1] - k} ${lineEnd}` };
}

function Wires({ wires, branchWires, selectedId }: { wires: Wire[]; branchWires: Wire[]; selectedId: string }) {
  const tierOf = (id: string) => stages.find((step) => step.id === id)!.tier;
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const cycle = wires.length * 1.3;
  return <svg className="arch-wires" aria-hidden="true">
    <defs>
      {(["source", "backend", "database", "client"] as Tier[]).map((tier) => <marker key={tier} id={`wire-head-${tier}`} viewBox="0 0 10 10" refX="0" refY="5" markerUnits="userSpaceOnUse" markerWidth={ARROW} markerHeight={ARROW} orient="auto"><path d="M0,1 L10,5 L0,9 Z" style={{ fill: `var(--tier-${tier})` }} /></marker>)}
      {wires.map((wire, index) => <linearGradient key={index} id={`wire-paint-${index}`} gradientUnits="userSpaceOnUse" x1={wire.start[0]} y1={wire.start[1]} x2={wire.end[0]} y2={wire.end[1]}>
        <stop offset="0" style={{ stopColor: `var(--tier-${tierOf(wire.from)})` }} />
        <stop offset="1" style={{ stopColor: `var(--tier-${tierOf(wire.to)})` }} />
      </linearGradient>)}
    </defs>
    <marker id="wire-head-dlq" viewBox="0 0 10 10" refX="0" refY="5" markerUnits="userSpaceOnUse" markerWidth={ARROW} markerHeight={ARROW} orient="auto"><path d="M0,1 L10,5 L0,9 Z" style={{ fill: "var(--rose)" }} /></marker>
    {branchWires.map((wire, index) => <path key={`branch-${index}`} d={wire.d} className={`arch-branch ${[wire.from, wire.to].includes(selectedId) ? "is-active" : ""}`} markerEnd="url(#wire-head-dlq)" />)}
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

// A live event's logo gliding through the pipeline; pulses each stage it reaches.
function LiveToken({ event, arch, onDone }: { event: LiveEvent; arch: HTMLElement; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  // Keep the latest callback without restarting the flight: a new event re-renders
  // every token with a fresh onDone, which must not reset tokens already in flight.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const token = ref.current;
    if (!token) return;
    const pulse = (stepId: string) => {
      const node = arch.querySelector(`[data-step="${stepId}"]`);
      node?.classList.add("is-receiving");
      window.setTimeout(() => node?.classList.remove("is-receiving"), 700);
    };
    const paths = [...arch.querySelectorAll<SVGPathElement>("path.arch-wire")];
    pulse(flow[0].from);
    return flyToken(paths, token, (wire) => pulse(flow[wire].to), () => done.current());
  }, [arch]);
  return <div ref={ref} className={`arch-token arch-token--${event.kind.toLowerCase()}`} aria-hidden="true">
    <span className="arch-token__bubble">{event.app ? <AppIcon app={event.app} url={event.iconUrl} size={26} /> : <i />}</span>
    <em>{event.kind}</em>
  </div>;
}

export function Pipeline() {
  const [selectedId, setSelectedId] = useState(steps[0].id);
  const selected = stages.find((step) => step.id === selectedId) ?? steps[0];
  const step = (id: string) => stages.find((candidate) => candidate.id === id)!;
  const archRef = useRef<HTMLElement>(null);
  const visuals = useRef(new Map<string, HTMLElement>());
  const [wires, setWires] = useState<Wire[]>([]);
  const [branchWires, setBranchWires] = useState<Wire[]>([]);
  const register = useCallback((id: string, element: HTMLElement | null) => { if (element) visuals.current.set(id, element); else visuals.current.delete(id); }, []);
  const node = (id: string) => <Node step={step(id)} selectedId={selectedId} onSelect={setSelectedId} register={register} />;
  const [tokens, setTokens] = useState<{ id: number; event: LiveEvent }[]>([]);
  const [lastEvent, setLastEvent] = useState<LiveEvent | null>(null);
  const removeToken = useCallback((id: number) => setTokens((current) => current.filter((token) => token.id !== id)), []);

  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const source = new EventSource("/api/v1/live");
    let next = 0;
    source.addEventListener("pipeline", (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as LiveEvent;
      setLastEvent(event);
      if (!reduceMotion) setTokens((current) => [...current.slice(-4), { id: next++, event }]);
    });
    return () => source.close();
  }, []);

  useLayoutEffect(() => {
    const arch = archRef.current;
    if (!arch) return;
    const measure = () => {
      const base = arch.getBoundingClientRect();
      const relative = (r: DOMRect) => new DOMRect(r.left - base.left, r.top - base.top, r.width, r.height);
      const rect = (id: string) => relative(visuals.current.get(id)!.getBoundingClientRect());
      const nodeRect = (id: string) => relative((visuals.current.get(id)!.closest(".arch-node") ?? visuals.current.get(id)!).getBoundingClientRect());
      const present = ({ from, to }: { from: string; to: string }) => visuals.current.has(from) && visuals.current.has(to);
      const routes = flow.filter(present).map(({ from, to }) => route(from, to, rect(from), rect(to), nodeRect(from), nodeRect(to)));
      spreadSharedAnchors(routes);
      setWires(routes.map(toWire));
      setBranchWires(branches.filter(present).map(({ from, to }) => branchWire(from, to, rect(from), rect(to), nodeRect(from))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(arch);
    return () => observer.disconnect();
  }, []);

  return <section id="pipeline" className="pipeline-page" aria-label="Data pipeline">
    <header className="pipeline-intro">
      <p className="pipeline-live" aria-live="polite"><i aria-hidden="true" />{lastEvent ? `Live · ${liveEventLabel(lastEvent)}` : "Live · open an app on your iPhone to watch its event flow through"}</p>
    </header>

    <section className="arch" ref={archRef} aria-label="Usage data architecture">
      <Wires wires={wires} branchWires={branchWires} selectedId={selectedId} />
      {archRef.current && tokens.map((token) => <LiveToken key={token.id} event={token.event} arch={archRef.current!} onDone={() => removeToken(token.id)} />)}
      <section className="arch-group arch-group--source" style={{ gridArea: "source" }} aria-label="Source"><GroupHeader tier="source" />{node("capture")}</section>
      <section className="arch-group arch-group--client" style={{ gridArea: "client" }} aria-label="Client"><GroupHeader tier="client" />{node("dashboard")}</section>
      <section className="arch-group arch-group--backend" aria-label="Backend">
        <GroupHeader tier="backend" />
        <div className="arch-lane arch-lane--write" aria-label="Backend write path">
          <span className="arch-lane__label">Write path</span>
          <GroupHeader tier="backend" lane="write path" role="Ingest and process events" />
          {node("ingest")}{node("stream")}{node("transform")}{node("dlq")}
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
      <span className="pipeline-inspector__number">{steps.includes(selected) ? String(steps.indexOf(selected) + 1).padStart(2, "0") : "!"}</span>
      <div><p className="eyebrow">{tierLabel(selected)} · {selected.label}</p><h2>{selected.title}</h2><p>{selected.detail}</p></div>
      <span className="pipeline-inspector__event">{selected.event}</span>
    </section>

  </section>;
}
