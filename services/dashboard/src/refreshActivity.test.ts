import { afterEach, describe, expect, it, vi } from "vitest";
import { watchActivity } from "./refreshActivity";

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("summary activity refresh", () => {
  it("refreshes after a burst of live events and cancels pending refresh on navigation", () => {
    vi.useFakeTimers();
    let onEvent: () => void = () => {};
    const close = vi.fn();
    vi.stubGlobal("EventSource", class {
      constructor(public url: string) { expect(url).toBe("/api/v1/live"); }
      addEventListener(name: string, callback: () => void) { expect(name).toBe("pipeline"); onEvent = callback; }
      close = close;
    });
    const refresh = vi.fn();
    const stop = watchActivity(refresh);
    onEvent(); vi.advanceTimersByTime(200); onEvent();
    vi.advanceTimersByTime(399); expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(refresh).toHaveBeenCalledTimes(1);
    onEvent(); stop(); vi.advanceTimersByTime(500);
    expect(refresh).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledOnce();
  });
  it("allows polling to operate when EventSource is unavailable", () => {
    vi.stubGlobal("EventSource", undefined);
    expect(() => watchActivity(vi.fn())()).not.toThrow();
  });
});
