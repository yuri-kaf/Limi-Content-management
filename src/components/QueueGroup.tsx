import { Clock, RotateCcw, CalendarClock, CalendarPlus } from 'lucide-react';
import { TodayEntry, TodayGroups, slotLabel } from '../today';
import StagePill from './StagePill';
import ClientAvatar from './ClientAvatar';
import { faintText, rowList, queueRow, countChip, sectionLabel } from '../ui';
import { STAGES } from '../utils';

export interface QueueSection {
  key: keyof TodayGroups;
  id: string;
  label: string;
  hint: string;
  icon: typeof Clock;
}

export const QUEUE_SECTIONS: QueueSection[] = [
  {
    key: 'waitingOnClient', id: 'waiting', label: 'Waiting on a client', icon: Clock,
    hint: 'Sitting in Review with no decision yet.',
  },
  {
    key: 'needsRework', id: 'rework', label: 'Needs rework', icon: RotateCcw,
    hint: 'Declined, and not yet replaced.',
  },
  {
    key: 'goingOutSoon', id: 'soon', label: 'Going out soon', icon: CalendarClock,
    hint: 'Booked inside the next week, or already slipped.',
  },
  {
    key: 'readyToSchedule', id: 'schedule', label: 'Ready to schedule', icon: CalendarPlus,
    hint: 'Approved, but with no slot booked.',
  },
];

// A row is deliberately dense: this is a queue you scan, not a gallery. The
// title owns the width — it is the only thing on the row that identifies the
// work — and the client name moved under it, because a fixed 112px column of
// "Mortgage Superh…" repeated eleven times was the loudest thing on the page
// and told you the least.
export function QueueRow({
  entry, now, onOpen, showSource = true,
}: {
  entry: TodayEntry;
  now: number;
  onOpen: () => void;
  /**
   * The avatar and name of the client (or business) the item belongs to. Off
   * where every row would name the same one — a single client's own queue.
   */
  showSource?: boolean;
}) {
  const slot = slotLabel(entry.item.scheduledAt, now);
  // Something already posted cannot be late, however old its slot.
  const late = !!slot?.late && entry.item.status !== 'posted';
  const when = entry.item.scheduledAt
    ? new Date(entry.item.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;
  const stage = STAGES.find((s) => s.id === entry.item.status)?.label;
  const name = [
    showSource ? `${entry.item.title} — ${entry.clientName}` : entry.item.title,
    slot?.text,
    // The label replaces the row's content for a screen reader, so it has to
    // carry the stage too: the one signal that says whose move it is.
    stage,
  ].filter(Boolean).join(', ');

  return (
    <button
      onClick={onOpen}
      className={queueRow}
      // Spelled out because the row's text is split across nested spans, which
      // left the button with no computed name in the accessibility tree.
      aria-label={name}
    >
      {showSource && (
        <ClientAvatar
          name={entry.clientName}
          imageUrl={entry.clientImageUrl}
          color={entry.clientColor}
          size={22}
        />
      )}

      <span className="flex-1 min-w-0">
        <span className="block text-[13px] leading-snug text-ink dark:text-ink-dark truncate">
          {entry.item.title}
        </span>
        {/* Flex, not one truncating line: the client name is the part that may
            be cut, and "2 months late" is the part that must not be. */}
        <span className={`flex items-center text-[11px] leading-snug min-w-0 ${faintText}`}>
          {showSource && <span className="truncate">{entry.clientName}</span>}
          {slot && (
            <>
              {showSource && <span className="mx-1.5 opacity-50 flex-shrink-0">·</span>}
              {/* "2 months late" says what a red date only implied. */}
              <span
                className={`flex-shrink-0 ${late ? 'text-brand dark:text-red-400 font-medium' : ''}`}
              >
                {slot.text}
              </span>
            </>
          )}
        </span>
      </span>

      {/* The exact date is the same fact as the relative label beside the client
          name, so a phone shows one of the two and gives the width to the title
          instead. */}
      {when && (
        <span
          className={`hidden sm:block text-[11px] font-medium tabular-nums flex-shrink-0 ${
            late ? 'text-brand dark:text-red-400' : faintText
          }`}
        >
          {when}
        </span>
      )}
      {/* The stage used to be hidden below sm, which left a phone row showing no
          stage at all — the one signal that says whose move it is. */}
      <span className="flex-shrink-0">
        <StagePill status={entry.item.status} />
      </span>
    </button>
  );
}

export function QueueGroup({
  section, entries, now, onOpen, showSource = true,
}: {
  section: QueueSection;
  entries: TodayEntry[];
  now: number;
  onOpen: (e: TodayEntry) => void;
  /** See QueueRow. */
  showSource?: boolean;
}) {
  if (entries.length === 0) return null;
  const { icon: Icon } = section;
  return (
    <section id={section.id} className="mb-6 scroll-mt-4">
      {/* One line, not three. The label, the count and the explanation used to
          occupy a stacked header taller than two of the rows beneath it. */}
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <Icon size={13} className={faintText} />
        <span className={sectionLabel}>{section.label}</span>
        <span className={countChip}>{entries.length}</span>
        <span className={`hidden md:block text-[11px] truncate ${faintText}`}>{section.hint}</span>
      </div>
      <div className={rowList}>
        {entries.map((e) => (
          <QueueRow
            key={`${e.clientId}-${e.item.id}`}
            entry={e}
            now={now}
            onOpen={() => onOpen(e)}
            showSource={showSource}
          />
        ))}
      </div>
    </section>
  );
}
