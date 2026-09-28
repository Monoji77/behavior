// Coalesce notification bursts (one CLOSE can complete multiple app sessions).
// Periodic refresh in the summary views remains the fallback during reconnects.
export function watchActivity(refresh: () => void): () => void {
  if (typeof EventSource === "undefined") return () => {};
  const source = new EventSource("/api/v1/live");
  let timer: ReturnType<typeof setTimeout> | undefined;
  source.addEventListener("pipeline", () => {
    clearTimeout(timer);
    timer = setTimeout(refresh, 400);
  });
  return () => { clearTimeout(timer); source.close(); };
}
