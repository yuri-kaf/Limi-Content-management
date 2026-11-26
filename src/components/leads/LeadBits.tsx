import { useRef, useState } from 'react';
import {
  Instagram, Facebook, MessageCircle, Phone, Mail, Footprints, Users, CalendarDays, Globe,
  MoreHorizontal, Star, ChevronDown, CalendarClock, X, Calendar,
} from '../../icons';
import { useTheme } from '../../contexts/ThemeContext';
import { LeadPotential, LeadSource, LeadStatus } from '../../types';
import {
  FOLLOW_UP_PRESETS, LEAD_STATUSES, followUpLabel, followUpState, leadStatus, shortDay,
} from '../../leads';
import Menu, { type MenuEntry } from '../m3/Menu';
import { focusRing } from '../../ui';

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

const SOURCE_ICONS: Record<LeadSource, React.ComponentType<{ size?: number | string; className?: string }> | null> = {
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

// The status as its own pill, and the pill opens an M3 menu grouped by where a
// lead stands. The caller decides what a choice means (Denied asks for a
// reason; Onboarded makes a client).
export function LeadStatusSelect({ value, onChange, leadName, size = 'sm', options, fill }: StatusSelectProps) {
  const colours = useStatusColours(value);
  const { theme } = useTheme();
  const h = size === 'sm' ? 'h-7 [@media(hover:none)]:h-9 text-[11px]' : 'h-9 text-[12px]';
  const items: MenuEntry[] = [];
  (['active', 'parked', 'closed'] as const).forEach((group) => {
    const inGroup = LEAD_STATUSES.filter((s) => s.group === group && (!options || options.includes(s.id)));
    if (inGroup.length === 0) return;
    if (items.length > 0) items.push('divider');
    inGroup.forEach((s) =>
      items.push({
        key: s.id,
        label: s.label,
        checked: s.id === value,
        icon: (
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: theme === 'dark' ? s.textDark : s.text }}
            aria-hidden="true"
          />
        ),
        onSelect: () => onChange(s.id),
      })
    );
  });
  return (
    <span className={`relative inline-flex flex-shrink-0 ${fill ? 'w-full' : ''}`}>
      <Menu
        label={`Set status of ${leadName}`}
        minWidth={176}
        items={items}
        trigger={(t) => (
          <button
            type="button"
            {...t}
            aria-label={`Status of ${leadName}`}
            className={`${fill ? 'w-full' : ''} ${h} inline-flex items-center justify-between gap-1 pl-2.5 pr-1.5 rounded-full font-medium cursor-pointer whitespace-nowrap transition-[filter] hover:brightness-95 dark:hover:brightness-110 ${focusRing}`}
            style={colours}
          >
            <span className="truncate">{leadStatus(value).label}</span>
            <ChevronDown size={14} aria-hidden="true" className="flex-shrink-0" />
          </button>
        )}
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
  const base = 'inline-flex items-center gap-1 h-7 [@media(hover:none)]:h-9 px-2.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors';
  if (state === 'overdue') return `${base} bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark`;
  if (state === 'today') return `${base} bg-warning-soft dark:bg-warning-softdark text-warning-text dark:text-warning-textdark`;
  if (state === 'upcoming') return `${base} bg-hover dark:bg-hover-dark text-ink-soft dark:text-ink-softdark`;
  return `${base} text-ink-faint dark:text-ink-faintdark hover:bg-hover dark:hover:bg-hover-dark hover:text-ink dark:hover:text-ink-dark`;
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

// A chip that opens an M3 menu of the usual gaps (tomorrow, a week, three
// months), a "Pick a date" choice that opens the browser's own date picker, and
// a way to clear it.
export function FollowUpPicker({ status, value, today, onChange, leadName, quietWhenEmpty }: FollowUpProps) {
  const dateInput = useRef<HTMLInputElement>(null);
  const state = followUpState({ status, followUpOn: value }, today);
  const label = value ? followUpLabel(value, today) : 'Follow up';

  function pickDate() {
    const el = dateInput.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  }

  const items: MenuEntry[] = [
    ...FOLLOW_UP_PRESETS.map((p) => {
      const day = p.day(today);
      return { key: p.label, label: p.label, trailing: shortDay(day, today), onSelect: () => onChange(day) };
    }),
    { key: 'pick', label: 'Pick a date', icon: <Calendar size={18} />, onSelect: pickDate },
  ];
  if (value) {
    items.push('divider', { key: 'clear', label: 'Clear follow-up', icon: <X size={18} />, onSelect: () => onChange(null) });
  }

  return (
    <span className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
      <Menu
        label={`Follow-up for ${leadName}`}
        minWidth={208}
        items={items}
        trigger={(t) => (
          <button
            type="button"
            {...t}
            aria-label={value ? `Follow up ${label} with ${leadName}, change` : `Set a follow-up for ${leadName}`}
            className={`${followUpChipClass(value ? state ?? 'upcoming' : null)} ${focusRing} ${
              !value && quietWhenEmpty ? '[@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100' : ''
            }`}
          >
            <CalendarClock size={14} aria-hidden="true" />
            {label}
          </button>
        )}
      />
      <input
        ref={dateInput}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        min={today}
        value={value ?? ''}
        onChange={(e) => {
          if (e.target.value) onChange(e.target.value);
        }}
        className="absolute left-0 bottom-0 w-full h-0 opacity-0 pointer-events-none"
      />
    </span>
  );
}
