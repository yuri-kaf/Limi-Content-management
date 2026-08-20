import { useNavigate } from 'react-router-dom';
import { Clock, RotateCcw, CalendarClock, CalendarPlus, CheckCircle2 } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { buildToday, TodayEntry, todayTotal } from '../today';
import StagePill from '../components/StagePill';
import {
  shell, heading, faintText, card, emptyState, emptyTitle, emptyBody, sectionLabel,
} from '../ui';

// A row is deliberately dense: this is a queue you scan, not a gallery.
function Row({ entry, onOpen }: { entry: TodayEntry; onOpen: () => void }) {
  const at = entry.item.scheduledAt ?? 0;
  const overdue = at > 0 && at < Date.now() && entry.item.status !== 'posted';
  const when = at > 0
    ? new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <button
      onClick={onOpen}
      className="w-full flex items-center gap-3 px-3 h-11 text-left rounded-tile hover:bg-hover dark:hover:bg-hover-dark transition-colors"
    >
      <span className={`text-[11px] font-medium w-28 truncate flex-shrink-0 ${faintText}`}>
        {entry.clientName}
      </span>
      <span className="text-[13px] text-ink dark:text-ink-dark truncate flex-1 min-w-0">
        {entry.item.title}
      </span>
      {when && (
        <span
          className={`text-[11px] font-medium tabular-nums flex-shrink-0 ${
            overdue ? 'text-brand dark:text-red-400' : faintText
          }`}
        >
          {when}
        </span>
      )}
      <span className="flex-shrink-0 hidden sm:block">
        <StagePill status={entry.item.status} />
      </span>
    </button>
  );
}

function Group({
  label,
  hint,
  icon: Icon,
  entries,
  onOpen,
}: {
  label: string;
  hint: string;
  icon: typeof Clock;
  entries: TodayEntry[];
  onOpen: (e: TodayEntry) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <Icon size={13} className={faintText} />
        <span className={sectionLabel}>{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ${faintText}`}>
          {entries.length}
        </span>
      </div>
      <p className={`px-1 mb-2 text-[11px] ${faintText}`}>{hint}</p>
      <div className={`${card} p-1`}>
        {entries.map((e) => (
          <Row key={`${e.clientId}-${e.item.id}`} entry={e} onOpen={() => onOpen(e)} />
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

  const groups = buildToday(visible, Date.now());
  const total = todayTotal(groups);

  // Opening the board is the honest destination: the item lives there, and the
  // detail sheet needs board context around it.
  const open = (e: TodayEntry) => navigate(`/client/${e.clientId}`);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6 max-w-[900px]`}>
        <h1 className={`${heading} text-lg mb-1`}>Today</h1>
        <p className={`text-[13px] mb-6 ${faintText}`}>
          {loading
            ? 'Loading…'
            : total === 0
              ? 'Nothing is waiting.'
              : `${total} thing${total === 1 ? '' : 's'} across ${visible.length} client${visible.length === 1 ? '' : 's'}.`}
        </p>

        {!loading && total === 0 ? (
          <div className={emptyState}>
            <div className={`${card} w-12 h-12 flex items-center justify-center`}>
              <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className={emptyTitle}>All clear</p>
            <p className={emptyBody}>
              Nothing is waiting on a client, nothing was declined, and nothing is
              due in the next week. This is the good case.
            </p>
          </div>
        ) : (
          <>
            <Group
              label="Waiting on a client"
              hint="Sitting in Review with no decision yet."
              icon={Clock}
              entries={groups.waitingOnClient}
              onOpen={open}
            />
            <Group
              label="Needs rework"
              hint="Declined, and not yet replaced."
              icon={RotateCcw}
              entries={groups.needsRework}
              onOpen={open}
            />
            <Group
              label="Going out soon"
              hint="Booked inside the next week. Anything in red has already slipped."
              icon={CalendarClock}
              entries={groups.goingOutSoon}
              onOpen={open}
            />
            <Group
              label="Ready to schedule"
              hint="Approved, but with no slot booked — so it is not going anywhere."
              icon={CalendarPlus}
              entries={groups.readyToSchedule}
              onOpen={open}
            />
          </>
        )}
      </div>
    </div>
  );
}
