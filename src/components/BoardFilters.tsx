import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X, Check } from 'lucide-react';
import { MediaType, Platform } from '../types';
import { PLATFORM_LABELS } from '../utils';
import {
  ContentFilters, DATE_WINDOWS, DateWindow, NO_FILTERS, activeFilterCount,
} from '../filters';
import { btnGhost, card, sectionLabel, faintText, navBadge } from '../ui';

const TYPES: { id: MediaType | 'all'; label: string }[] = [
  { id: 'all', label: 'Any type' },
  { id: 'video', label: 'Video' },
  { id: 'graphic', label: 'Graphic' },
];

const PLATFORMS: Platform[] = ['instagram', 'facebook', 'tiktok'];

interface Props {
  value: ContentFilters;
  onChange: (next: ContentFilters) => void;
}

const row =
  'w-full flex items-center gap-2 h-7 px-2 rounded-tile text-[13px] text-left transition-colors text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark';

export default function BoardFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(value);

  // Close on an outside click or Escape — a popover you cannot dismiss without
  // hitting the trigger again is a trap.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function setDate(date: DateWindow) {
    onChange({ ...value, date });
  }
  function setType(mediaType: MediaType | 'all') {
    onChange({ ...value, mediaType });
  }
  function togglePlatform(p: Platform) {
    const on = value.platforms.includes(p);
    onChange({
      ...value,
      platforms: on ? value.platforms.filter((x) => x !== p) : [...value.platforms, p],
    });
  }

  return (
    <div ref={wrap} className="relative flex items-center gap-1.5 flex-shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`${btnGhost} h-9 min-h-0 px-2.5 text-[12px]`}
        aria-expanded={open}
        aria-label="Filters"
      >
        <SlidersHorizontal size={13} />
        <span className="hidden sm:inline">Filter</span>
        {count > 0 && <span className={`${navBadge} ml-0`}>{count}</span>}
      </button>

      {/* Active filters as removable chips, so the state is never hidden behind
          a closed popover. */}
      {count > 0 && (
        <button
          onClick={() => onChange(NO_FILTERS)}
          className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-medium ${faintText} hover:text-brand transition-colors`}
        >
          <X size={11} />
          Clear
        </button>
      )}

      {open && (
        <div
          className={`${card} absolute top-10 right-0 z-40 w-56 p-2 shadow-lift`}
          role="dialog"
          aria-label="Filters"
        >
          <div className={`${sectionLabel} px-2 pb-1`}>Date</div>
          {DATE_WINDOWS.map((d) => (
            <button key={d.id} onClick={() => setDate(d.id)} className={row}>
              <span className="flex-1 truncate">{d.label}</span>
              {value.date === d.id && <Check size={13} className="text-brand" />}
            </button>
          ))}

          <div className={`${sectionLabel} px-2 pt-3 pb-1`}>Content type</div>
          {TYPES.map((t) => (
            <button key={t.id} onClick={() => setType(t.id)} className={row}>
              <span className="flex-1 truncate">{t.label}</span>
              {value.mediaType === t.id && <Check size={13} className="text-brand" />}
            </button>
          ))}

          <div className={`${sectionLabel} px-2 pt-3 pb-1`}>Platform</div>
          {PLATFORMS.map((p) => (
            <button key={p} onClick={() => togglePlatform(p)} className={row}>
              <span className="flex-1 truncate">{PLATFORM_LABELS[p]}</span>
              {value.platforms.includes(p) && <Check size={13} className="text-brand" />}
            </button>
          ))}

          {count > 0 && (
            <button
              onClick={() => onChange(NO_FILTERS)}
              className={`${row} mt-2 text-brand hover:text-brand`}
            >
              <X size={13} />
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
