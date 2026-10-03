import { Pencil } from 'lucide-react';
import { Business } from '../../types';
import { BusinessSummary } from '../../campaigns';
import ClientAvatar from '../ClientAvatar';
import ColorLabel from '../ColorLabel';
import { btnIcon, cardInteractive, faintText, heading } from '../../ui';

interface Props {
  business: Business;
  summary: BusinessSummary;
  /** True when the workspace is scoped to this business. */
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

// Two sibling buttons, not one inside the other (invalid HTML): the card scopes
// the workspace to this business, the pencil edits it. The pencil is always
// visible below lg, where there is no hover to reveal it.
export default function BusinessCard({ business, summary, selected, canManage, onSelect, onEdit }: Props) {
  return (
    <div
      className={`group relative ${cardInteractive} ${
        selected ? '!bg-tint dark:!bg-tint-dark !border-ink-faint/50 dark:!border-ink-faintdark/50' : ''
      }`}
    >
      <button
        onClick={onSelect}
        aria-pressed={selected}
        className="w-full text-left p-3.5 pr-12 flex items-start gap-3 rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      >
        <ClientAvatar name={business.name} imageUrl={business.logoUrl} color={business.color} size={36} />
        <span className="flex-1 min-w-0">
          <span className={`${heading} block text-[14px] truncate`}>{business.name}</span>
          <span className={`block text-[11px] mt-0.5 ${faintText}`}>
            {plural(summary.total, 'item')}
            {summary.activeCampaigns > 0 && ` · ${plural(summary.activeCampaigns, 'active campaign')}`}
          </span>
          {summary.awaitingReview > 0 && (
            <span className="flex mt-2">
              <ColorLabel color="sky">{summary.awaitingReview} awaiting review</ColorLabel>
            </span>
          )}
        </span>
      </button>
      {canManage && (
        <button
          onClick={onEdit}
          // btnIcon's own 36px, not a smaller override: a w-7 written after it
          // would lose anyway (Tailwind orders same-property utilities itself),
          // and 36px is the better target on a phone. pr-12 above keeps the
          // name clear of it.
          className={`${btnIcon} absolute top-2 right-2 [@media(hover:hover)]:lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100`}
          aria-label={`Edit ${business.name}`}
        >
          <Pencil size={13} />
        </button>
      )}
    </div>
  );
}
