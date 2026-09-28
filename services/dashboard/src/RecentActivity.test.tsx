import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecentActivity } from "./RecentActivity";
import { type RecentActivity as Activity } from "./api";

const activity: Activity = { app: "Telegram", deviceId: "Phone", iconUrl: null, status: "ACTIVE", openedAt: "2026-09-28T08:00:00Z", closedAt: null, durationMilliseconds: null };

describe("recent activity", () => {
  it("shows an active app's opening date and time without completed usage", () => {
    const html = renderToStaticMarkup(<RecentActivity activity={activity} loading={false} deviceSelected />);
    expect(html).toContain("Active now");
    expect(html).toContain("Opened at");
    expect(html).toContain('dateTime="2026-09-28T08:00:00Z"');
    expect(html).not.toContain("Usage time");
    expect(html).not.toContain("Closed at");
  });
  it("shows a closed session's usage and closing timestamp", () => {
    const html = renderToStaticMarkup(<RecentActivity activity={{ ...activity, status: "COMPLETED", closedAt: "2026-09-28T08:03:12Z", durationMilliseconds: 192000 }} loading={false} deviceSelected />);
    expect(html).toContain("Session closed");
    expect(html).toContain("Usage time");
    expect(html).toContain("3 min 12 s");
    expect(html).toContain('dateTime="2026-09-28T08:03:12Z"');
    expect(html).not.toContain("Opened at");
  });
  it("reports zero-second sessions and explains an empty history", () => {
    const zero = renderToStaticMarkup(<RecentActivity activity={{ ...activity, status: "COMPLETED", closedAt: activity.openedAt, durationMilliseconds: 0 }} loading={false} deviceSelected />);
    expect(zero).toContain("0 s");
    const empty = renderToStaticMarkup(<RecentActivity activity={null} loading={false} deviceSelected />);
    expect(empty).toContain("No active or closed sessions recorded yet.");
  });
});
