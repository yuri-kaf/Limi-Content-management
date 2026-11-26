import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from '../icons';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { buildToday, TodayEntry, todayTotal, todaySources } from '../today';
import { QUEUE_SECTIONS, QueueGroup } from '../components/QueueGroup';
import { shellPad, heading, faintText, card, emptyState, emptyTitle, emptyBody, chip } from '../ui';

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
        {/* One headline: the day, then the count in the same line. */}
        <h1 className={`${heading} text-[22px] leading-8 font-normal`}>
          {today}
          <span className={`block sm:inline text-[14px] sm:ml-3 ${faintText}`}>
            {loading
              ? 'Loading…'
              : total === 0
                ? 'Nothing is waiting'
                : `${total} thing${total === 1 ? '' : 's'} across ${visible.length} client${visible.length === 1 ? '' : 's'}`}
          </span>
        </h1>

        {/* A jump strip, but only when there is more than one place to jump to.
            With a single group it would be a label for the thing directly under
            it. */}
        {filled.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            {filled.map((s) => (
              <button
                key={s.id}
                // scrollIntoView rather than an href: a hash link would push a
                // history entry, so Back would step through the jump strip
                // instead of leaving the page.
                onClick={() =>
                  document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
                className={chip(false)}
              >
                {s.label}
                <span className="tabular-nums font-semibold">{groups[s.key].length}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-4">
          {!loading && total === 0 ? (
            <div className={emptyState}>
              <CheckCircle2 size={28} className="text-success-text dark:text-success-textdark" />
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
