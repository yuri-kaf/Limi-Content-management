import { useNavigate } from 'react-router-dom';
import { User, ChevronRight, Pencil } from 'lucide-react';
import { Client, ContentStatus } from '../types';
import { STAGES } from '../utils';
import { cardInteractive, heading, bodyText, faintText, btnIcon } from '../ui';
import StagePill from './StagePill';

interface Props {
  client: Client;
  /** Absent when the viewer may not edit clients. */
  onEdit?: () => void;
}

export default function ClientCard({ client, onEdit }: Props) {
  const navigate = useNavigate();

  const statusCounts = client.content.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasContent = client.content.length > 0;

  return (
    <button
      onClick={() => navigate(`/client/${client.id}`)}
      className={`group ${cardInteractive} w-full text-left p-4 focus:outline-none focus:ring-2 focus:ring-brand/30`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {client.imageUrl ? (
            <img
              src={client.imageUrl}
              alt={client.name}
              className="w-9 h-9 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-tint dark:bg-tint-dark border border-hairline dark:border-hairline-dark flex items-center justify-center flex-shrink-0">
              <User size={15} className={faintText} />
            </div>
          )}
          <div className="min-w-0">
            <h3 className={`${heading} truncate text-[14px] leading-tight`}>
              {client.name}
            </h3>
            <span className={`text-xs mt-0.5 block ${faintText}`}>
              {client.content.length} item{client.content.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onEdit && (
            // A button inside a button is invalid HTML, so this is a span with
            // a button role — the card itself is the outer button.
            <span
              role="button"
              tabIndex={0}
              aria-label={`Edit ${client.name}`}
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onEdit(); }
              }}
              className={`${btnIcon} w-7 h-7 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity`}
            >
              <Pencil size={13} />
            </span>
          )}
          <ChevronRight
            size={14}
            className={`${faintText} group-hover:text-ink-soft dark:group-hover:text-ink-softdark transition-colors mt-1`}
          />
        </div>
      </div>

      {/* About */}
      {client.about && (
        <p className={`text-[13px] line-clamp-2 leading-relaxed mb-3 ${bodyText}`}>
          {client.about}
        </p>
      )}

      {/* Stage breakdown. Reads from STAGES rather than a local colour map —
          this card used to render its own set, in which To Post was brand red. */}
      {hasContent && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-hairline dark:border-hairline-dark">
          {STAGES.filter((s) => statusCounts[s.id]).map((s) => (
            <StagePill
              key={s.id}
              status={s.id as ContentStatus}
              count={statusCounts[s.id]}
            />
          ))}
        </div>
      )}
    </button>
  );
}
