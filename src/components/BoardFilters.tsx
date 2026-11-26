import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SlidersHorizontal, X, Check } from '../icons';
import { MediaType, Platform } from '../types';
import { PLATFORM_LABELS } from '../utils';
import {
  ContentFilters, DATE_WINDOWS, DateWindow, NO_FILTERS, activeFilterCount,
} from '../filters';
import { chip, faintText, focusRing, focusRingInset } from '../ui';

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

const row = `w-full flex items-center gap-3 h-8 [@media(hover:none)]:h-11 px-3 text-left text-[13px] text-ink dark:text-ink-dark transition-colors hover:bg-ink/[.06] dark:hover:bg-ink-dark/[.08] focus-visible:bg-ink/[.06] dark:focus-visible:bg-ink-dark/[.08] ${focusRingInset}`;
const header = `px-3 pt-2 pb-1 text-[12px] font-medium ${faintText}`;

// The filter chip and its popover. The popover is an M3 menu in a portal, so
// no scroll region clips it, but a form rather than a menu: it stays open while
// you tick several things, and closes on Escape or a press outside.
export default function BoardFilters({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(value);

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    function place() {
      const r = trigger.current!.getBoundingClientRect();
      const w = panel.current?.offsetWidth ?? 232;
      const h = panel.current?.offsetHeight ?? 0;
      const below = r.bottom + 4 + h <= window.innerHeight - 8;
      const top = below ? r.bottom + 4 : Math.max(8, r.top - 4 - h);
      const left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
      setPos({ top, left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent | TouchEvent) {
      const t = e.target as Node;
      if (panel.current?.contains(t) || trigger.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

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
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        ref={trigger}
        onClick={() => setOpen((o) => !o)}
        className={chip(count > 0)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Filters"
      >
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">Filter</span>
        {count > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[11px] font-medium tabular-nums">
            {count}
          </span>
        )}
      </button>

      {count > 0 && (
        <button
          onClick={() => onChange(NO_FILTERS)}
          className={`hidden sm:inline-flex items-center gap-1 text-[12px] font-medium ${faintText} hover:text-brand-text dark:hover:text-brand-textdark transition-colors rounded-chip ${focusRing}`}
        >
          <X size={14} />
          Clear
        </button>
      )}

      {open &&
        createPortal(
          <div
            ref={panel}
            role="dialog"
            aria-label="Filters"
            className="fixed z-[70] w-[232px] py-1.5 rounded-card bg-canvas dark:bg-hover-dark shadow-float animate-scale-in origin-top max-h-[80dvh] overflow-y-auto"
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          >
            <div className={header}>Date</div>
            {DATE_WINDOWS.map((d) => (
              <button key={d.id} onClick={() => setDate(d.id)} className={row}>
                <span className="flex-1 truncate">{d.label}</span>
                {value.date === d.id && <Check size={18} className="text-ink-soft dark:text-ink-softdark" />}
              </button>
            ))}

            <div role="separator" className="my-1.5 border-t border-hairline dark:border-hairline-dark" />
            <div className={header}>Content type</div>
            {TYPES.map((t) => (
              <button key={t.id} onClick={() => setType(t.id)} className={row}>
                <span className="flex-1 truncate">{t.label}</span>
                {value.mediaType === t.id && <Check size={18} className="text-ink-soft dark:text-ink-softdark" />}
              </button>
            ))}

            <div role="separator" className="my-1.5 border-t border-hairline dark:border-hairline-dark" />
            <div className={header}>Platform</div>
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => togglePlatform(p)} className={row}>
                <span className="flex-1 truncate">{PLATFORM_LABELS[p]}</span>
                {value.platforms.includes(p) && <Check size={18} className="text-ink-soft dark:text-ink-softdark" />}
              </button>
            ))}

            {count > 0 && (
              <>
                <div role="separator" className="my-1.5 border-t border-hairline dark:border-hairline-dark" />
                <button
                  onClick={() => onChange(NO_FILTERS)}
                  className={`${row} !text-brand-text dark:!text-brand-textdark`}
                >
                  <X size={18} />
                  Clear all filters
                </button>
              </>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
