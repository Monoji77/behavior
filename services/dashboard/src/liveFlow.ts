import { formatDuration } from "./format";

// Moves a live-event token along the pipeline's wires, stage by stage. Purely a
// visual: timing is chosen to read smoothly, not to match real processing time.

export interface LiveEvent {
  kind: "OPEN" | "CLOSE";
  app: string | null;
  iconUrl: string | null;
  deviceId: string | null;
  at: string | null;
  durationMilliseconds: number | null;
}

export const TRAVEL_MILLISECONDS = 1100;
export const HOP_MILLISECONDS = 380;

export function liveEventLabel(event: LiveEvent): string {
  const who = event.app ?? "An app";
  if (event.kind === "OPEN") return `${who} opened`;
  return event.durationMilliseconds == null ? `${who} closed` : `${who} closed · ${formatDuration(event.durationMilliseconds)} session`;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Animates `token` through every wire in order; calls onArrive(i) as it reaches the
// end of wire i and done() at the end. Returns a cancel function.
export function flyToken(paths: SVGPathElement[], token: HTMLElement, onArrive: (wireIndex: number) => void, done: () => void): () => void {
  if (!paths.length) { done(); return () => undefined; }
  type Phase = { travel?: SVGPathElement; from?: DOMPoint; to?: DOMPoint; ms: number; wire: number };
  const phases: Phase[] = [];
  paths.forEach((path, wire) => {
    phases.push({ travel: path, ms: TRAVEL_MILLISECONDS, wire });
    const next = paths[wire + 1];
    if (next) phases.push({ from: path.getPointAtLength(path.getTotalLength()), to: next.getPointAtLength(0), ms: HOP_MILLISECONDS, wire });
  });
  let index = 0;
  let started = performance.now();
  let frame = 0;
  const place = (point: DOMPoint) => { token.style.transform = `translate(${point.x}px, ${point.y}px)`; };
  const tick = (now: number) => {
    const phase = phases[index];
    const t = Math.min(1, (now - started) / phase.ms);
    if (phase.travel) {
      const length = phase.travel.getTotalLength();
      place(phase.travel.getPointAtLength(length * ease(t)));
    } else if (phase.from && phase.to) {
      place(new DOMPoint(phase.from.x + (phase.to.x - phase.from.x) * t, phase.from.y + (phase.to.y - phase.from.y) * t));
    }
    if (t < 1) { frame = requestAnimationFrame(tick); return; }
    if (phase.travel) onArrive(phase.wire);
    index += 1;
    started = now;
    if (index >= phases.length) { done(); return; }
    frame = requestAnimationFrame(tick);
  };
  place(paths[0].getPointAtLength(0));
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
