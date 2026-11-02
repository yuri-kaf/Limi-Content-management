import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Instagram, Facebook, MessageCircle, Phone, Mail, Footprints, Users, CalendarDays, Globe,
  MoreHorizontal, Star, ChevronDown, CalendarClock, X,
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { LeadPotential, LeadSource, LeadStatus } from '../../types';
import {
  FOLLOW_UP_PRESETS, LEAD_STATUSES, followUpLabel, followUpState, leadStatus, shortDay,
} from '../../leads';
import { focusRing, input } from '../../ui';

// ─── Platform icon ───────────────────────────────────────────────────────────

// lucide has no TikTok mark, so it is drawn here: the note glyph, filled, in
// the same box as the stroked icons beside it.
function TikTokIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.6-2.6 2.6 2.6 0 0 1 3.37-2.48V9.66a5.73 5.73 0 0 0-.77-.05 5.69 5.69 0 0 0-5.69 5.69A5.69 5.69 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.29 4.29 0 0 1-3.25-1.48Z" />
    </svg>
  );
}

const SOURCE_ICONS: Record<LeadSource, typeof Instagram | null> = {
  instagram: Instagram,
  tiktok: null,
  facebook: Facebook,
  whatsapp: MessageCircle,
  call: Phone,
  email: Mail,
  'walk-in': Footprints,
  referral: Users,
  event: CalendarDays,
  website: Globe,
  other: MoreHorizontal,
};

export function SourceIcon({ source, size = 14 }: { source: LeadSource; size?: number }) {
  const Icon = SOURCE_ICONS[source];
  return Icon ? <Icon size={size} aria-hidden="true" /> : <TikTokIcon size={size} />;
}

// ─── Status ──────────────────────────────────────────────────────────────────

function useStatusColours(status: LeadStatus) {
  const { theme } = useTheme();
  const s = leadStatus(status);
  return theme === 'dark'
    ? { backgroundColor: s.tintDark, color: s.textDark }
    : { backgroundColor: s.tint, color: s.text };
}

export function LeadStatusPill({ status }: { status: LeadStatus }) {
  return (
    <span
      className="inline-flex items-center px-2 h-[22px] rounded-tile text-[11px] font-medium whitespace-nowrap"
      style={useStatusColours(status)}
    >
      {leadStatus(status).label}
    </span>
  );
}

interface StatusSelectProps {
  value: LeadStatus;
  onChange: (status: LeadStatus) => void;
  /** Name of the lead, for the control's accessible name. */
  leadName: string;
  size?: 'sm' | 'md';
  /** Limit the menu, as the form does by leaving out Onboarded. */
  options?: LeadStatus[];
  /** Fill the parent's width, so a column of them lines up. */
  fill?: boolean;
}

// The status as its own pill, and the pill is the menu: a native select keeps
// the phone's own picker and full keyboard support. The caller decides what
// a choice means (Denied asks for a reason; Onboarded makes a client).
export function LeadStatusSelect({ value, onChange, leadName, size = 'sm', options, fill }: StatusSelectProps) {
  const colours = useStatusColours(value);
  const h = size === 'sm' ? 'h-7 [@media(hover:none)]:h-9 text-[11px]' : 'h-9 text-[12px]';
  return (
    <span className={`relative inline-flex flex-shrink-0 ${fill ? 'w-full' : ''}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LeadStatus)}
        aria-label={`Status of ${leadName}`}
        className={`appearance-none ${fill ? 'w-full' : ''} ${h} pl-2 pr-6 rounded-tile font-semibold cursor-pointer border border-transparent hover:border-hairline dark:hover:border-hairline-dark ${focusRing}`}
        style={colours}
      >
        {(['active', 'parked', 'closed'] as const).map((group) => (
          <optgroup
            key={group}
            label={group === 'active' ? 'In progress' : group === 'parked' ? 'Parked' : 'Closed'}
          >
            {LEAD_STATUSES.filter((s) => s.group === group && (!options || options.includes(s.id))).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        size={12}
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2"
        style={{ color: colours.color }}
      />
    </span>
  );
}

// ─── Potential ───────────────────────────────────────────────────────────────

const POTENTIAL_WORDS = ['', 'Low', 'Good', 'Great'];

interface StarsProps {
  value?: LeadPotential;
  onChange?: (value: LeadPotential | null) => void;
  size?: number;
}

// Three stars, the one thing that separates the businesses worth chasing from
// the rest of a long list. Clicking the lit top star again clears it.
export function PotentialStars({ value, onChange, size = 14 }: StarsProps) {
  const [hover, setHover] = useState(0);
  const shown = hover || value || 0;
  if (!onChange) {
    if (!value) return null;
    return (
      <span className="inline-flex items-center" aria-label={`${POTENTIAL_WORDS[value]} potential`}>
        {[1, 2, 3].map((n) => (
          <Star
            key={n}
            size={size}
            aria-hidden="true"
            className={n <= value ? 'fill-warning text-warning dark:fill-warning-textdark dark:text-warning-textdark' : 'text-hairline dark:text-hairline-dark'}
          />
        ))}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center"
      role="radiogroup"
      aria-label="Potential"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3].map((n) => {
        const on = n <= shown;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${POTENTIAL_WORDS[n]} potential (${n} of 3)`}
            title={`${POTENTIAL_WORDS[n]} potential`}
            onMouseEnter={() => setHover(n)}
            onClick={(e) => {
              e.stopPropagation();
              onChange(value === n ? null : (n as LeadPotential));
            }}
            className={`inline-flex items-center justify-center w-6 h-7 [@media(hover:none)]:w-8 [@media(hover:none)]:h-9 rounded-chip transition-colors ${focusRing}`}
          >
            <Star
              size={size}
              aria-hidden="true"
              className={
                on
                  ? 'fill-warning text-warning dark:fill-warning-textdark dark:text-warning-textdark'
                  : 'text-ink-faint/40 dark:text-ink-faintdark/40'
              }
            />
          </button>
        );
      })}
    </span>
  );
}

// ─── Follow-up ───────────────────────────────────────────────────────────────

/** A follow-up date as a chip: red when late, amber today, quiet otherwise. */
export function followUpChipClass(state: ReturnType<typeof followUpState>) {
  const base = 'inline-flex items-center gap-1 h-7 [@media(hover:none)]:h-9 px-2 rounded-tile text-[11px] font-semibold whitespace-nowrap border transition-colors';
  if (state === 'overdue') return `${base} bg-brand-soft dark:bg-brand-softdark border-brand/25 text-brand-text dark:text-brand-textdark`;
  if (state === 'today') return `${base} bg-warning-soft dark:bg-warning-softdark border-warning/25 text-warning-text dark:text-warning-textdark`;
  if (state === 'upcoming') return `${base} bg-tint dark:bg-tint-dark border-hairline dark:border-hairline-dark text-ink-soft dark:text-ink-softdark`;
  return `${base} border-dashed border-hairline dark:border-hairline-dark text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark`;
}

interface FollowUpProps {
  status: LeadStatus;
  value?: string;
  today: string;
  onChange: (day: string | null) => void;
  leadName: string;
  /** Draw an empty value as "Follow up" (default) or hide it until hovered. */
  quietWhenEmpty?: boolean;
}

// A chip that opens a small menu of the usual gaps (tomorrow, a week, three
// months) and a date field for anything else. The menu is portalled: rows sit
// in clipped lists and dialogs, which would cut a positioned menu off.
export function FollowUpPicker({ status, value, today, onChange, leadName, quietWhenEmpty }: FollowUpProps) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const state = followUpState({ status, followUpOn: value }, today);
  const label = value ? followUpLabel(value, today) : 'Follow up';

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Follow up ${label} with ${leadName}, change` : `Set a follow-up for ${leadName}`}
        className={`${followUpChipClass(value ? state ?? 'upcoming' : null)} ${focusRing} ${
          !value && quietWhenEmpty ? 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100' : ''
        }`}
      >
        <CalendarClock size={12} aria-hidden="true" />
        {label}
      </button>
      {open && (
        <Popover anchor={btn.current} onClose={() => setOpen(false)}>
          <div className="w-56 p-1.5" role="dialog" aria-label={`Follow-up for ${leadName}`}>
            {FOLLOW_UP_PRESETS.map((p) => {
              const day = p.day(today);
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    onChange(day);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center justify-between h-8 [@media(hover:none)]:h-11 px-2 rounded-chip text-[12px] text-ink dark:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark ${focusRing}`}
                >
                  {p.label}
                  <span className="text-[11px] text-ink-faint dark:text-ink-faintdark">
                    {shortDay(day, today)}
                  </span>
                </button>
              );
            })}
            <div className="px-2 pt-2 pb-1">
              <input
                type="date"
                value={value ?? ''}
                min={today}
                onChange={(e) => {
                  if (e.target.value) {
                    onChange(e.target.value);
                    setOpen(false);
                  }
                }}
                aria-label="Pick a day"
                className={`${input} !py-1.5 !text-[12px]`}
              />
            </div>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-1.5 h-8 [@media(hover:none)]:h-11 px-2 rounded-chip text-[12px] text-ink-soft dark:text-ink-softdark hover:bg-hover dark:hover:bg-hover-dark ${focusRing}`}
              >
                <X size={12} aria-hidden="true" />
                Clear follow-up
              </button>
            )}
          </div>
        </Popover>
      )}
    </>
  );
}

// ─── Popover ─────────────────────────────────────────────────────────────────

interface PopoverProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: ReactNode;
}

// Fixed to the viewport under its anchor (above it when there is no room),
// closed by Escape, an outside press, or the page scrolling away under it.
export function Popover({ anchor, onClose, children }: PopoverProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !panel.current) return;
    const a = anchor.getBoundingClientRect();
    const p = panel.current.getBoundingClientRect();
    const below = a.bottom + 4 + p.height <= window.innerHeight - 8;
    const top = below ? a.bottom + 4 : Math.max(8, a.top - 4 - p.height);
    const left = Math.min(Math.max(8, a.left), window.innerWidth - p.width - 8);
    setPos({ top, left });
  }, [anchor]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        anchor?.focus();
      }
    }
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (panel.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    }
    function onScroll(e: Event) {
      if (panel.current?.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  // Focus moves into the menu so a keyboard user lands on the first choice.
  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('button, input')?.focus();
  }, []);

  return createPortal(
    <div
      ref={panel}
      onClick={(e) => e.stopPropagation()}
      className="fixed z-[60] bg-surface dark:bg-surface-dark border border-hairline dark:border-hairline-dark rounded-card shadow-lift animate-scale-in"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
    >
      {children}
    </div>,
    document.body
  );
}
