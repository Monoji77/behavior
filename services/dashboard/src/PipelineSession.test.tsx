import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PipelineSession } from "./PipelineSession";
import { type CurrentActivity } from "./api";

const activity: CurrentActivity = {
  app: "Telegram", deviceId: "Phone", iconUrl: null, status: "ACTIVE",
  openedAt: "2026-09-28T08:00:00Z", closedAt: null, durationMilliseconds: null
};

describe("pipeline current session", () => {
  it("shows only the opened date and time for an active session", () => {
    const html = renderToStaticMarkup(<PipelineSession activity={activity} loading={false} />);
    expect(html).toContain("Telegram");
    expect(html).toContain("Active now");
    expect(html).toContain("Opened at");
    expect(html).toContain('dateTime="2026-09-28T08:00:00Z"');
    expect(html).not.toContain("Closed at");
    expect(html).not.toContain("Usage time");
  });

  it("shows usage duration and closed date and time for a completed session", () => {
    const html = renderToStaticMarkup(<PipelineSession activity={{ ...activity, status: "COMPLETED", closedAt: "2026-09-28T08:01:15Z", durationMilliseconds: 75000 }} loading={false} />);
    expect(html).toContain("Session closed");
    expect(html).toContain("Usage time");
    expect(html).toContain("1 min 15 s");
    expect(html).toContain('dateTime="2026-09-28T08:01:15Z"');
    expect(html).not.toContain("Opened at");
  });

  it("preserves zero-second sessions and handles empty/loading activity", () => {
    expect(renderToStaticMarkup(<PipelineSession activity={{ ...activity, status: "COMPLETED", closedAt: activity.openedAt, durationMilliseconds: 0 }} loading={false} />)).toContain("0 s");
    expect(renderToStaticMarkup(<PipelineSession activity={null} loading={false} />)).toContain("No app sessions recorded yet.");
    expect(renderToStaticMarkup(<PipelineSession activity={null} loading={true} />)).toContain("Loading activity");
  });
});
