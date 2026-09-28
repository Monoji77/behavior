// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DateRangeChip } from "./DateRangeChip";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function openPicker() {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<DateRangeChip from="2026-09-22T00:00" to="2026-09-28T23:59" earliestUsageAt="2026-09-22T00:00:00Z" onChange={onChange} />);
  await user.click(screen.getByRole("button", { expanded: false }));
  return { user, onChange };
}

const day = (isoDate: string) => {
  const label = new Intl.DateTimeFormat("en-US", { dateStyle: "long" }).format(new Date(isoDate + "T12:00:00"));
  return screen.getByRole("button", { name: (name, element) => name.includes(label) && element.textContent?.trim() === String(Number(isoDate.slice(8))) });
};

describe("date range selection", () => {
  it("keeps the picker open after the start and completes a later range across empty usage days", async () => {
    const { user, onChange } = await openPicker();
    await user.click(day("2026-09-22"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(day("2026-09-23").getAttribute("aria-disabled")).not.toBe("true");
    await user.click(day("2026-09-24"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-22T00:00", "2026-09-24T23:59");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("allows tomorrow as the end after selecting today", async () => {
    const { user, onChange } = await openPicker();
    await user.click(day("2026-09-28"));
    expect(day("2026-09-29").getAttribute("aria-disabled")).not.toBe("true");
    await user.click(day("2026-09-29"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-28T00:00", "2026-09-29T23:59");
  });

  it("supports a next-month end and keeps the earliest and seven-day limits", async () => {
    const { user, onChange } = await openPicker();
    expect(day("2026-09-21").getAttribute("aria-disabled")).toBe("true");
    await user.click(day("2026-09-28"));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(day("2026-10-06").getAttribute("aria-disabled")).toBe("true");
    await user.click(day("2026-10-06"));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(day("2026-10-05"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-28T00:00", "2026-10-05T23:59");
  });
});
