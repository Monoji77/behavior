import type { ReactNode } from "react";

// Isometric illustrations for the pipeline page. Shapes are coloured from the
// surrounding tier through CSS classes (iso-top/-left/-right/...), so they follow
// the tier palette and both themes.

type Point = [number, number];

// Isometric projection: x runs down-right, y runs down-left, z runs up.
const COS30 = Math.cos(Math.PI / 6);
const SIN30 = 0.5;
const iso = (x: number, y: number, z: number, origin: Point = [60, 48]): Point =>
  [origin[0] + (x - y) * COS30, origin[1] + (x + y) * SIN30 - z];
const points = (list: Point[]) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

function Box({ x, y, z, w, d, h, origin, className = "" }: { x: number; y: number; z: number; w: number; d: number; h: number; origin?: Point; className?: string }) {
  const p = (px: number, py: number, pz: number) => iso(px, py, pz, origin);
  return <g className={className}>
    <polygon className="iso-left" points={points([p(x, y + d, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x, y + d, z + h)])} />
    <polygon className="iso-right" points={points([p(x + w, y, z), p(x + w, y + d, z), p(x + w, y + d, z + h), p(x + w, y, z + h)])} />
    <polygon className="iso-top" points={points([p(x, y, z + h), p(x + w, y, z + h), p(x + w, y + d, z + h), p(x, y + d, z + h)])} />
  </g>;
}

// Upright cylinder centred on screen point (cx, top); rx/ry are the iso ellipse radii.
function Cylinder({ cx, top, rx, ry, h, className = "" }: { cx: number; top: number; rx: number; ry: number; h: number; className?: string }) {
  return <g className={className}>
    <path className="iso-left" d={`M${cx - rx},${top} v${h} a${rx},${ry} 0 0 0 ${rx * 2},0 v${-h} Z`} />
    <path className="iso-right" d={`M${cx},${top + ry} v${h} a${rx},${ry} 0 0 0 ${rx},${-ry} v${-h} Z`} />
    <ellipse className="iso-top" cx={cx} cy={top} rx={rx} ry={ry} />
  </g>;
}

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return <svg className="iso" viewBox="0 0 120 110" role="img" aria-label={label}>{children}</svg>;
}

export function PhoneArt() {
  // A standing iPhone: the large face (towards the viewer) is the screen.
  const o: Point = [44, 82];
  const p = (x: number, y: number, z: number) => iso(x, y, z, o);
  const rect = (x: number, z: number, w: number, h: number) => points([p(x, 6, z), p(x + w, 6, z), p(x + w, 6, z + h), p(x, 6, z + h)]);
  return <Frame label="iPhone">
    <ellipse className="iso-shadow" cx="62" cy="102" rx="26" ry="6" />
    <Box x={0} y={0} z={0} w={34} d={6} h={68} origin={o} />
    <polygon className="iso-screen" points={rect(2.2, 2.2, 29.6, 63.6)} />
    <polygon className="iso-island" points={rect(12, 60, 10, 2.6)} />
    {/* notification: the OPEN event being sent */}
    <polygon className="iso-notify" points={rect(4, 43, 26, 11)} />
    <polygon className="iso-notify-icon" points={rect(6, 45.5, 6, 6)} />
    <polygon className="iso-screen-line" points={rect(14, 50, 13, 1.6)} />
    <polygon className="iso-screen-line" points={rect(14, 46.5, 9, 1.6)} />
    {[0, 1].map((row) => [0, 1, 2, 3].map((col) => <polygon key={`${row}-${col}`} className={`iso-app iso-app--${(row * 4 + col) % 4}`} points={rect(4.5 + col * 6.6, 25 - row * 9, 5, 5)} />))}
    <polygon className="iso-home" points={rect(12, 5, 10, 1.3)} />
  </Frame>;
}

// Cloud service with its server blocks hanging below.
export function ApiCloudArt({ variant }: { variant: "ingest" | "serve" }) {
  const blocks = [[26, 78], [52, 86], [78, 78]];
  return <Frame label={variant === "ingest" ? "Ingestion API" : "Analytics API"}>
    <ellipse className="iso-shadow" cx="60" cy="100" rx="42" ry="8" />
    {blocks.map(([x, y]) => <path key={x} className="iso-wire" d={`M${x + 8},${y - 6} C${x + 8},${y - 18} 60,50 60,46`} />)}
    {blocks.map(([x, y]) => <Box key={`b${x}`} x={0} y={0} z={0} w={12} d={9} h={9} origin={[x + 4, y - 9]} className="iso-server" />)}
    <path className="iso-cloud-side" d="M22,50 a14,14 0 0 1 10,-22 a19,19 0 0 1 34,-8 a16,16 0 0 1 26,12 a12,12 0 0 1 4,22 Z" transform="translate(0,7)" />
    <path className="iso-cloud-top" d="M22,50 a14,14 0 0 1 10,-22 a19,19 0 0 1 34,-8 a16,16 0 0 1 26,12 a12,12 0 0 1 4,22 Z" />
    {variant === "ingest"
      ? <g className="iso-badge"><path d="M44,38 h14 m-5,-5 5,5 -5,5" /><path d="M64,36 l4,4 8,-9" /></g>
      : <g className="iso-badge"><path d="M48,44 v-6 M55,44 v-11 M62,44 v-8 M69,44 v-14" /></g>}
  </Frame>;
}

export function KafkaArt() {
  // A partitioned log: three lanes with event blocks sliding along them.
  const o: Point = [40, 40];
  return <Frame label="Kafka">
    <ellipse className="iso-shadow" cx="62" cy="92" rx="44" ry="10" />
    <Box x={0} y={0} z={0} w={62} d={40} h={8} origin={o} />
    {[0, 1, 2].map((lane) => {
      const y = 5 + lane * 12;
      const p = (x: number, yy: number) => iso(x, yy, 8, o);
      return <g key={lane}>
        <polygon className="iso-lane" points={points([p(4, y), p(58, y), p(58, y + 7), p(4, y + 7)])} />
        <g className={`iso-slide iso-slide--${lane}`}>
          {[0, 1].map((k) => <Box key={k} x={6 + k * 18} y={y + 1} z={8} w={9} d={5} h={5} origin={o} className="iso-event" />)}
        </g>
      </g>;
    })}
  </Frame>;
}

export function WorkerArt() {
  // The stream processor keeps its node-graph character, lifted into the iso scene.
  return <Frame label="Stream processor">
    <ellipse className="iso-shadow" cx="60" cy="94" rx="36" ry="9" />
    <path className="iso-plate" d="M60,72 l32,14 -32,14 -32,-14 Z" />
    <g className="iso-graph">
      <path d="M38,34 L82,34 M38,34 L60,70 M82,34 L60,70" />
      <circle className="iso-node" cx="38" cy="34" r="9" />
      <circle className="iso-node" cx="82" cy="34" r="9" />
      <circle className="iso-node iso-node--out" cx="60" cy="70" r="10" />
    </g>
  </Frame>;
}

export function DatabaseArt() {
  // Three stacked discs: raw events, sessions, rollups.
  return <Frame label="TimescaleDB">
    <ellipse className="iso-shadow" cx="60" cy="98" rx="38" ry="9" />
    {[62, 44, 26].map((top) => <Cylinder key={top} cx={60} top={top} rx={30} ry={11} h={14} className="iso-disc" />)}
    <path className="iso-series" d="M40,27 l8,-4 7,3 8,-6 7,2 8,-5" />
  </Frame>;
}

export function DashboardArt() {
  // A monitor on a stand, showing a small version of the usage chart.
  const o: Point = [32, 70];
  const p = (x: number, y: number, z: number) => iso(x, y, z, o);
  return <Frame label="Dashboard">
    <ellipse className="iso-shadow" cx="62" cy="98" rx="34" ry="8" />
    <Box x={24} y={-2} z={0} w={16} d={12} h={3} origin={o} className="iso-stand" />
    <Box x={30} y={4} z={3} w={4} d={2} h={16} origin={o} className="iso-stand" />
    <Box x={0} y={0} z={18} w={64} d={5} h={40} origin={o} />
    <polygon className="iso-screen" points={points([p(3, 5, 21), p(61, 5, 21), p(61, 5, 55), p(3, 5, 55)])} />
    <polyline className="iso-chart" points={points([p(7, 5, 27), p(17, 5, 36), p(27, 5, 30), p(37, 5, 44), p(47, 5, 38), p(57, 5, 50)])} />
  </Frame>;
}
