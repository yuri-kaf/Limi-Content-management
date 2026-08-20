import { useNavigate } from 'react-router-dom';
import { Clock, RotateCcw, CalendarClock, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { buildToday, TodayEntry, TodayGroups, slotLabel, todayTotal } from '../today';
import StagePill from '../components/StagePill';
import ClientAvatar from '../components/ClientAvatar';
import {
  shell, heading, faintText, card, rowList, queueRow, countChip, sectionLabel,
  emptyState, emptyTitle, emptyBody,
} from '../ui';

interface Section {
  key: keyof TodayGroups;
  id: string;
  label: string;
  hint: string;
  icon: typeof Clock;
}

const SECTIONS: Section[] = [
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
function Row({ entry, now, onOpen }: { entry: TodayEntry; now: number; onOpen: () => void }) {
  const slot = slotLabel(entry.item.scheduledAt, now);
  // Something already posted cannot be late, however old its slot.
  const late = !!slot?.late && entry.item.status !== 'posted';
  const when = entry.item.scheduledAt
    ? new Date(entry.item.scheduledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      onClick={onOpen}
      className={queueRow}
      // Spelled out because the row's text is split across nested spans, which
      // left the button with no computed name in the accessibility tree.
      aria-label={`${entry.item.title} — ${entry.clientName}${slot ? `, ${slot.text}` : ''}`}
    >
      <ClientAvatar name={entry.clientName} imageUrl={entry.clientImageUrl} size={22} />

      <span className="flex-1 min-w-0">
        <span className="block text-[13px] leading-snug text-ink dark:text-ink-dark truncate">
          {entry.item.title}
        </span>
        {/* Flex, not one truncating line: the client name is the part that may
            be cut, and "2 months late" is the part that must not be. */}
        <span className={`flex items-center text-[11px] leading-snug min-w-0 ${faintText}`}>
          <span className="truncate">{entry.clientName}</span>
          {slot && (
            <>
              <span className="mx-1.5 opacity-50 flex-shrink-0">·</span>
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

function Group({
  section, entries, now, onOpen,
}: {
  section: Section;
  entries: TodayEntry[];
  now: number;
  onOpen: (e: TodayEntry) => void;
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
          <Row key={`${e.clientId}-${e.item.id}`} entry={e} now={now} onOpen={() => onOpen(e)} />
        ))}
      </div>
    </section>
  );
}

// The home page answers one question: what needs me. The clients grid answers
// "what exists", which is a different and much less frequent question.
export default function TodayPage() {
  const navigate = useNavigate();
  const { clients, loading } = useClients();
  const { currentUser } = useAuth();

  const isClientRole = currentUser?.role === 'client';
  const visible = isClientRole
    ? clients.filter((c) => currentUser?.assignedClientIds?.includes(c.id))
    : clients;

  const now = Date.now();
  const groups = buildToday(visible, now);
  const total = todayTotal(groups);
  const filled = SECTIONS.filter((s) => groups[s.key].length > 0);

  // Open the item, not just the board it lives on. Landing on a board with
  // sixty cards and being left to find the one you clicked is not navigation.
  const open = (e: TodayEntry) => navigate(`/client/${e.clientId}?item=${e.item.id}`);

  const today = new Date(now).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6 max-w-[820px]`}>
        <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
          <h1 className={`${heading} text-lg`}>Today</h1>
          <span className={`text-[12px] ${faintText}`}>{today}</span>
        </div>
        <p className={`text-[13px] ${faintText}`}>
          {loading
            ? 'Loading…'
            : total === 0
              ? 'Nothing is waiting.'
              : `${total} thing${total === 1 ? '' : 's'} across ${visible.length} client${visible.length === 1 ? '' : 's'}.`}
        </p>

        {/* A jump strip, but only when there is more than one place to jump to.
            With a single group it would be a label for the thing directly under
            it. */}
        {filled.length > 1 && (
          <div className="flex items-center gap-1.5 flex-wrap mt-3.5">
            {filled.map((s) => (
              <button
                key={s.id}
                // scrollIntoView rather than an href: a hash link would push a
                // history entry, so Back would step through the jump strip
                // instead of leaving the page.
                onClick={() =>
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-tile bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark text-[11px] font-medium text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark transition-colors"
              >
                {s.label}
                <span className="tabular-nums font-semibold">{groups[s.key].length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-5">
          {!loading && total === 0 ? (
            <div className={emptyState}>
              <div className="w-11 h-11 rounded-tile bg-tint dark:bg-tint-dark flex items-center justify-center">
                <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className={emptyTitle}>All clear</p>
              <p className={emptyBody}>
                Nothing is waiting on a client, nothing was declined, and nothing is
                due in the next week. This is the good case.
              </p>
            </div>
          ) : (
            SECTIONS.map((section) => (
              <Group
                key={section.id}
                section={section}
                entries={groups[section.key]}
                now={now}
                onOpen={open}
              />
            ))
          )}
        </div>

        {/* Loading renders as an empty page with a count of "Loading…" above it,
            which reads as a broken page rather than a busy one. */}
        {loading && (
          <div className={`${card} p-1`}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 px-3 h-[52px]">
                <div className="w-[22px] h-[22px] rounded-tile bg-tint dark:bg-tint-dark animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-1/2 rounded bg-tint dark:bg-tint-dark animate-pulse" />
                  <div className="h-2 w-1/4 rounded bg-tint dark:bg-tint-dark animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
