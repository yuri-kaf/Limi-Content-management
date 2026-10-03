import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { buildToday, TodayEntry, todayTotal, todaySources } from '../today';
import { QUEUE_SECTIONS, QueueGroup } from '../components/QueueGroup';
import { shellPad, heading, faintText, card, emptyState, emptyTitle, emptyBody } from '../ui';

// The home page answers one question: what needs me. The clients grid answers
// "what exists", which is a different and much less frequent question.
export default function TodayPage() {
  const navigate = useNavigate();
  const { clients, loading } = useClients();
  const { currentUser } = useAuth();

  const visible = todaySources(clients, currentUser);

  const now = Date.now();
  const groups = buildToday(visible, now);
  const total = todayTotal(groups);
  const filled = QUEUE_SECTIONS.filter((s) => groups[s.key].length > 0);

  // Open the item, not just the board it lives on. Landing on a board with
  // sixty cards and being left to find the one you clicked is not navigation.
  const open = (e: TodayEntry) => navigate(`/client/${e.clientId}?item=${e.item.id}`);

  const today = new Date(now).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shellPad} max-w-[820px] py-6`}>
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
            QUEUE_SECTIONS.map((section) => (
              <QueueGroup
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
