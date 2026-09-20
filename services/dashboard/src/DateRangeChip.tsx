import { getLocalTimeZone, parseDate, today, type CalendarDate } from "@internationalized/date";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  Heading,
  RangeCalendar,
} from "react-aria-components";

const dayFromDateTime = (value: string) => value.slice(0, 10);
const dateTimeWithDay = (day: CalendarDate, existing: string, endOfDay = false) =>
  day.toString() + "T" + (existing.slice(11) || (endOfDay ? "23:59" : "00:00"));
const formatDay = (value: string) =>
  new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(dayFromDateTime(value) + "T12:00:00"));
const localDay = (isoInstant: string) => {
  const date = new Date(isoInstant);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};

function RangeCell({ date, maxValue }: { date: CalendarDate; maxValue: CalendarDate }) {
  const isTodayDate = date.compare(today(getLocalTimeZone())) === 0;
  const isPredictive = date.compare(today(getLocalTimeZone())) > 0 && date.compare(maxValue) <= 0;

  return (
    <CalendarCell
      date={date}
      className={({ isSelected, isSelectionStart, isSelectionEnd, isFocusVisible, isDisabled, isOutsideMonth }) =>
        [
          "rc-cell",
          isSelected && "rc-cell--selected",
          isSelectionStart && "rc-cell--start",
          isSelectionEnd && "rc-cell--end",
          isFocusVisible && "rc-cell--focus",
          isDisabled && "rc-cell--disabled",
          isOutsideMonth && "rc-cell--outside",
        ].filter(Boolean).join(" ")
      }
    >
      {({ formattedDate, isSelected, isSelectionStart, isSelectionEnd }) => (
        <span
          className="rc-cell__inner"
          data-today={isTodayDate ? "" : undefined}
          data-predictive={isPredictive && !isSelected ? "" : undefined}
          data-marked={isSelectionStart || isSelectionEnd ? "" : undefined}
        >
          {formattedDate}
          {isTodayDate && <span className="rc-cell__today-dot" aria-hidden="true" />}
        </span>
      )}
    </CalendarCell>
  );
}

interface DateRangeChipProps {
  from: string;
  to: string;
  earliestUsageAt: string | null;
  onChange: (from: string, to: string) => void;
}

export function DateRangeChip({ from, to, earliestUsageAt, onChange }: DateRangeChipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const maxValue = today(getLocalTimeZone()).add({ days: 7 });
  const minValue = earliestUsageAt ? parseDate(localDay(earliestUsageAt)) : undefined;
  const value = { start: parseDate(dayFromDateTime(from)), end: parseDate(dayFromDateTime(to)) };

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  return (
    <div className="date-range-chip-wrap" ref={rootRef}>
      <button type="button" className="date-range-chip" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="date-range-chip__label">{formatDay(from)}</span>
        <span className="date-range-chip__dash">–</span>
        <span className="date-range-chip__label">{formatDay(to)}</span>
      </button>
      {open && (
        <div className="range-popover" role="dialog" aria-label="Choose a date range">
          <RangeCalendar
            aria-label="Usage rollup date range"
            value={value}
            minValue={minValue}
            maxValue={maxValue}
            onChange={(range) => {
              if (!range) return;
              onChange(dateTimeWithDay(range.start as CalendarDate, from), dateTimeWithDay(range.end as CalendarDate, to, true));
              setOpen(false);
            }}
          >
            <header className="range-popover__header">
              <Button slot="previous" aria-label="Previous month" className="range-popover__nav">‹</Button>
              <Heading className="range-popover__heading" />
              <Button slot="next" aria-label="Next month" className="range-popover__nav">›</Button>
            </header>
            <CalendarGrid className="range-grid" weekdayStyle="short">
              <CalendarGridHeader>
                {(day) => <CalendarHeaderCell className="range-grid__weekday">{day}</CalendarHeaderCell>}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(date) => <RangeCell date={date} maxValue={maxValue} />}
              </CalendarGridBody>
            </CalendarGrid>
            <footer className="range-popover__footer">
              <span className="range-popover__legend"><i className="range-popover__dot range-popover__dot--today" /> Today</span>
              <span className="range-popover__legend"><i className="range-popover__dot range-popover__dot--predictive" /> Predicted (up to +7d)</span>
            </footer>
          </RangeCalendar>
        </div>
      )}
    </div>
  );
}
