import { useEffect, useRef, useState } from "react";
import { Menu, MenuItem } from "@/components/ui/navbar-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppIcon } from "./AppIcon";

export interface FilterField {
  item: string;
  value: string;
  placeholder: string;
  tooltip: string;
  options: string[];
  icons?: Record<string, string>;
  onChange: (value: string) => void;
}

function Chevron() { return <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>; }

function OptionPanel({ field, loading, focusSearch, onSelect }: { field: FilterField; loading: boolean; focusSearch: boolean; onSelect: (value: string) => void }) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  // A click/tap can arrive after hover already opened the panel, so focus on every click-open.
  useEffect(() => { if (focusSearch) search.current?.focus(); }, [focusSearch]);
  const noun = field.item.toLocaleLowerCase();
  const matches = field.options.filter((option) => option.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="menu-options">
    <input ref={search} className="menu-search" value={query} placeholder={`Search ${noun}s`} aria-label={`Search ${noun}s`}
      onChange={(event) => setQuery(event.target.value)}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (matches[0]) onSelect(matches[0]); } }} />
    <ul role="listbox" aria-label={field.item} className="menu-list">
      {loading ? <li className="no-match">Loading available {noun}s…</li>
        : matches.length ? matches.map((option) => <li key={option}>
          <button type="button" role="option" aria-selected={option === field.value} className="menu-option" onClick={() => onSelect(option)}>
            {field.icons && <AppIcon app={option} url={field.icons[option]} />}<span>{option}</span>
          </button>
        </li>)
        : <li className="no-match">No matching {noun} found</li>}
    </ul>
  </div>;
}

// Device/App pickers: Aceternity hover menu, each trigger with a tooltip prompt.
export function FilterMenu({ fields, loading }: { fields: FilterField[]; loading: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const [openedByClick, setOpenedByClick] = useState(false);
  const hover = (item: string | null) => { setOpenedByClick(false); setActive(item); };
  return <Menu setActive={hover} className="filter-menu">
    {fields.map((field) => <MenuItem key={field.item} item={field.item} active={active} setActive={hover} trigger={
      <Tooltip>
        <TooltipTrigger type="button" className="filter-pill menu-pill" aria-haspopup="listbox" aria-expanded={active === field.item}
          onClick={() => { setOpenedByClick(true); setActive(field.item); }}>
          <span>{field.item}</span>
          <span className="menu-pill-value">
            {field.value && field.icons && <AppIcon app={field.value} url={field.icons[field.value]} size={16} />}
            <b className={field.value ? "" : "placeholder"}>{field.value || field.placeholder}</b><Chevron />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{field.tooltip}</TooltipContent>
      </Tooltip>
    }>
      <OptionPanel field={field} loading={loading} focusSearch={openedByClick}
        onSelect={(value) => { field.onChange(value); setActive(null); }} />
    </MenuItem>)}
  </Menu>;
}
