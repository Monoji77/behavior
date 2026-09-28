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

const recordedDays = ["2026-09-22", "2026-09-24", "2026-09-27", "2026-09-28"];

async function openPicker(availableDates = recordedDays) {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<DateRangeChip from="2026-09-22T00:00" to="2026-09-28T23:59" earliestUsageAt="2026-09-22T00:00:00Z" availableDates={availableDates} onChange={onChange} />);
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
    expect(day("2026-09-23").getAttribute("aria-disabled")).toBe("true");
    expect(day("2026-09-24").getAttribute("aria-disabled")).not.toBe("true");
    await user.click(day("2026-09-24"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-22T00:00", "2026-09-24T23:59");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("prevents empty days from becoming either endpoint", async () => {
    const { user, onChange } = await openPicker();
    await user.click(day("2026-09-23"));
    await user.click(day("2026-09-24"));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(day("2026-09-25"));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    await user.click(day("2026-09-28"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-24T00:00", "2026-09-28T23:59");
  });

  it("disables future dates without data and retains the earliest bound", async () => {
    const { user, onChange } = await openPicker();
    expect(day("2026-09-21").getAttribute("aria-disabled")).toBe("true");
    expect(day("2026-09-29").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Next month" }).hasAttribute("disabled")).toBe(true);
    await user.click(day("2026-09-27"));
    await user.click(day("2026-09-29"));
    expect(onChange).not.toHaveBeenCalled();
    await user.click(day("2026-09-28"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-27T00:00", "2026-09-28T23:59");
  });

  it("supports recorded endpoints across a month boundary", async () => {
    vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
    const { user, onChange } = await openPicker([...recordedDays, "2026-09-30", "2026-10-01"]);
    await user.click(day("2026-09-24"));
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(day("2026-10-02").getAttribute("aria-disabled")).toBe("true");
    await user.click(day("2026-10-01"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("2026-09-24T00:00", "2026-10-01T23:59");
  });

  it("allows no selections when there are no recorded dates", async () => {
    const { user, onChange } = await openPicker([]);
    for (const cell of screen.getAllByRole("button").filter((element) => element.classList.contains("rc-cell"))) {
      expect(cell.getAttribute("aria-disabled")).toBe("true");
    }
    await user.click(day("2026-09-22"));
    await user.click(day("2026-09-28"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
