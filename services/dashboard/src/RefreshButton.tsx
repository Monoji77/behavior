export type RefreshStatus = "idle" | "loading" | "done" | "error";

interface RefreshButtonProps {
  status: RefreshStatus;
}

export function RefreshButton({ status }: RefreshButtonProps) {
  const label = status === "loading" ? "Refreshing…" : status === "done" ? "Refreshed" : status === "error" ? "Refresh failed" : "Refresh data";

  return (
    <button className="refresh-mark" type="submit" disabled={status === "loading"} aria-label={label} title={label} data-status={status}>
      <svg className="refresh-mark__glyph" viewBox="0 0 24 24" width={20} height={20}>
        <circle className="refresh-mark__track" cx="12" cy="12" r="9" />
        <circle className="refresh-mark__ring" cx="12" cy="12" r="9" />
        <path className="refresh-mark__arrows" d="M6.5 9.5A5.6 5.6 0 0 1 12 6.3c1.7 0 3.2.75 4.2 1.95M17.5 14.5A5.6 5.6 0 0 1 12 17.7c-1.7 0-3.2-.75-4.2-1.95" />
        <path className="refresh-mark__arrowhead-a" d="M16.6 5.6v2.9h-2.9" />
        <path className="refresh-mark__arrowhead-b" d="M7.4 18.4v-2.9h2.9" />
        <path className="refresh-mark__check" d="M7.5 12.4 10.4 15.3 16.6 8.9" pathLength={1} />
        <path className="refresh-mark__cross" d="M8.4 8.4 15.6 15.6M15.6 8.4 8.4 15.6" pathLength={1} />
      </svg>
    </button>
  );
}
