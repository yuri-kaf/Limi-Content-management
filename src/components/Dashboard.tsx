import { Client, ContentItem, UserRole } from '../types';
import { tile, heading, faintText, bodyText } from '../ui';

const STAGES = [
  { id: 'editing', label: 'Editing', color: '#8b5cf6' },
  { id: 'review', label: 'In Review', color: '#0284c7' },
  { id: 'to-post', label: 'Ready to Post', color: '#d97706' },
  { id: 'posted', label: 'Posted', color: '#059669' },
] as const;

const DAY = 86_400_000;

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

// A headline number is a stat tile, not a chart — there is no shape to read.
function Stat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className={`${tile} p-4 sm:p-5`}>
      <div className="flex items-center gap-2">
        {accent && (
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
        )}
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${faintText}`}>
          {label}
        </span>
      </div>
      <p className={`${heading} text-2xl sm:text-3xl mt-2 tabular-nums`}>{value}</p>
      {hint && <p className={`text-xs mt-1 ${faintText}`}>{hint}</p>}
    </div>
  );
}

// Single series, magnitude by category → horizontal bars. One hue, sorted
// descending, values labelled directly so the bar length is never the only cue.
function VolumeBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <div key={r.label} className="group">
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className={`text-xs truncate ${bodyText}`} title={r.label}>
              {r.label}
            </span>
            <span className={`text-xs font-semibold tabular-nums ${heading}`}>{r.value}</span>
          </div>
          <div className="h-2 rounded-full bg-hairline dark:bg-hairline-dark overflow-hidden">
            <div
              className="h-full rounded-full bg-brand transition-all duration-500 motion-reduce:transition-none"
              style={{ width: `${(r.value / max) * 100}%` }}
              title={`${r.label}: ${r.value}`}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StageBreakdown({ items }: { items: ContentItem[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {STAGES.map((s) => {
        const count = items.filter((i) => i.status === s.id).length;
        return (
          <div key={s.id} className="flex flex-col gap-1.5">
            <div className="h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className={`text-lg font-semibold tabular-nums ${heading}`}>{count}</span>
            {/* Label always present — colour never carries meaning alone. */}
            <span className={`text-[11px] ${faintText}`}>{s.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ clients, role }: { clients: Client[]; role: UserRole }) {
  const all = clients.flatMap((c) => c.content);
  const now = Date.now();
  const monthStart = startOfMonth();

  const postedThisMonth = all.filter(
    (i) => i.status === 'posted' && (i.scheduledAt || i.createdAt) >= monthStart
  ).length;
  const awaitingReview = all.filter((i) => i.status === 'review').length;
  const readyToPost = all.filter((i) => i.status === 'to-post').length;

  const decided = all.filter((i) => i.clientReview === 'approved' || i.clientReview === 'declined');
  const declined = decided.filter((i) => i.clientReview === 'declined').length;
  const declineRate = decided.length ? Math.round((declined / decided.length) * 100) : 0;

  const dueThisWeek = all.filter(
    (i) => i.scheduledAt && i.scheduledAt >= now && i.scheduledAt <= now + 7 * DAY
  ).length;
  const overdue = all.filter(
    (i) => i.scheduledAt && i.scheduledAt > 0 && i.scheduledAt < now && i.status !== 'posted'
  ).length;

  const volume = clients
    .map((c) => ({ label: c.name, value: c.content.length }))
    .sort((a, b) => b.value - a.value)
    .filter((r) => r.value > 0);

  if (role === 'client') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Stat label="Posted this month" value={postedThisMonth} accent="#059669" />
        <Stat
          label="Needs your review"
          value={awaitingReview}
          hint={awaitingReview ? 'Waiting on you' : 'Nothing pending'}
          accent="#0284c7"
        />
        <Stat label="Scheduled next 7 days" value={dueThisWeek} accent="#d97706" />
      </div>
    );
  }

  const isAdmin = role === 'admin';

  return (
    <div className="flex flex-col gap-3 sm:gap-4 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Stat label="Posted this month" value={postedThisMonth} accent="#059669" />
        <Stat
          label="Awaiting client"
          value={awaitingReview}
          hint={awaitingReview ? 'Chase if stale' : 'All clear'}
          accent="#0284c7"
        />
        <Stat label="Due in 7 days" value={dueThisWeek} accent="#d97706" />
        <Stat
          label="Overdue"
          value={overdue}
          hint={overdue ? 'Past scheduled date' : 'Nothing late'}
          accent={overdue ? '#dc2626' : undefined}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className={`${tile} p-4 sm:p-5 lg:col-span-2`}>
          <h3 className={`text-sm ${heading} mb-4`}>Content per client</h3>
          {volume.length === 0 ? (
            <p className={`text-xs ${faintText}`}>Nothing to show yet.</p>
          ) : (
            <VolumeBars rows={volume} />
          )}
        </div>

        <div className={`${tile} p-4 sm:p-5 flex flex-col gap-4`}>
          <div>
            <h3 className={`text-sm ${heading} mb-3`}>Pipeline</h3>
            <StageBreakdown items={all} />
          </div>
          {isAdmin && (
            <div className="pt-3 border-t border-hairline dark:border-hairline-dark">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${faintText}`}>
                Client decline rate
              </span>
              <p className={`${heading} text-2xl mt-1.5 tabular-nums`}>{declineRate}%</p>
              <p className={`text-xs mt-0.5 ${faintText}`}>
                {decided.length ? `${declined} of ${decided.length} reviewed` : 'No decisions yet'}
              </p>
            </div>
          )}
          {!isAdmin && (
            <div className="pt-3 border-t border-hairline dark:border-hairline-dark">
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${faintText}`}>
                Ready to post
              </span>
              <p className={`${heading} text-2xl mt-1.5 tabular-nums`}>{readyToPost}</p>
              <p className={`text-xs mt-0.5 ${faintText}`}>Approved and queued</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
