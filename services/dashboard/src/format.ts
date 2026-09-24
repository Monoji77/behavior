// Durations with seconds under an hour ("45 s", "4 min 12 s"); hours stay "7h 14 min".
export function formatDuration(milliseconds?: number | null): string {
  if (!milliseconds) return "—";
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) {
    const rest = seconds % 60;
    return `${Math.floor(seconds / 60)} min` + (rest ? ` ${rest} s` : "");
  }
  const minutes = Math.round(seconds / 60);
  return `${Math.floor(minutes / 60)}h ${minutes % 60} min`;
}
