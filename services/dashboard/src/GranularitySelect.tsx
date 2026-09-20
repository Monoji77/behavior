import { useEffect, useRef, useState } from "react";
import type { Granularity } from "./api";

const OPTIONS: { value: Granularity; label: string }[] = [
  { value: "MINUTE", label: "minute view" },
  { value: "HOUR", label: "hour view" },
  { value: "DAY", label: "day view" },
];
const ROW_HEIGHT = 34;

function ChevronIcon() {
  return <svg className="gsel__chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>;
}
function CheckIcon() {
  return <svg className="gsel__check-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8" /></svg>;
}

interface GranularitySelectProps {
  value: Granularity;
  onChange: (value: Granularity) => void;
}

export function GranularitySelect({ value, onChange }: GranularitySelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectedIndex = OPTIONS.findIndex((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [open]);

  const pick = (index: number) => {
    const option = OPTIONS[index];
    if (option && option.value !== value) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const key = event.key;
    if (!open) {
      if (key === "Enter" || key === " " || key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        setActive(selectedIndex >= 0 ? selectedIndex : 0);
        setOpen(true);
      }
      return;
    }
    const current = active ?? Math.max(0, selectedIndex);
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const next = current + (key === "ArrowDown" ? 1 : -1);
      setActive(Math.min(OPTIONS.length - 1, Math.max(0, next)));
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      pick(current);
    } else if (key === "Escape" || key === "Tab") {
      if (key === "Escape") event.preventDefault();
      setOpen(false);
    }
  };

  const pillIndex = active ?? selectedIndex;

  return (
    <div className="gsel" ref={rootRef} data-open={open ? "" : undefined}>
      <button
        ref={triggerRef}
        type="button"
        className="gsel__trigger"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        onPointerDown={() => setOpen((current) => !current)}
        onKeyDown={onKeyDown}
      >
        <span className="gsel__sweep" aria-hidden="true" />
        <span className="gsel__label">{OPTIONS[selectedIndex]?.label ?? "view"}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="gsel__menu" role="listbox" aria-label="Group by" onPointerLeave={() => setActive(null)}>
          {pillIndex !== null && (
            <span className="gsel__pill" style={{ transform: `translateY(${pillIndex * ROW_HEIGHT}px)` }} aria-hidden="true" />
          )}
          {OPTIONS.map((option, index) => (
            <div
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className="gsel__option"
              onPointerEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              <span>{option.label}</span>
              {option.value === value && <CheckIcon />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
