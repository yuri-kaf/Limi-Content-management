import { CalendarDays } from 'lucide-react';
import { Campaign, ContentItem } from '../../types';
import {
  campaignProgress, campaignStatusMeta, deliverableProgress, formatDateRange,
} from '../../campaigns';
import { folderColor } from '../../folderColors';
import ColorLabel from '../ColorLabel';
import ProgressBar from '../ProgressBar';
import { cardInteractive, faintText, heading, focusRing } from '../../ui';

interface Props {
  campaign: Campaign;
  /** The client's content. The card picks out its own. */
  content: ContentItem[];
  /** Set when the client has several businesses, so the card says whose it is. */
  businessName?: string;
  onOpen: () => void;
}

export default function CampaignCard({ campaign, content, businessName, onOpen }: Props) {
  const progress = campaignProgress(campaign, content);
  const slots = deliverableProgress(campaign, content);
  const status = campaignStatusMeta(campaign.status);
  const dates = formatDateRange(campaign.startDate, campaign.endDate);
  const summary = `${progress.posted} of ${progress.planned} posted`;

  return (
    <button
      onClick={onOpen}
      className={`${cardInteractive} w-full text-left overflow-hidden flex ${focusRing}`}
    >
      {/* The campaign's colour as a spine, the way a coloured tab marks a binder. */}
      <span
        className="w-1 flex-shrink-0"
        style={{ backgroundColor: folderColor(campaign.color).swatch }}
        aria-hidden="true"
      />
      <span className="flex-1 min-w-0 p-3.5 flex flex-col gap-2">
        <span className="flex items-start gap-2">
          <span className={`${heading} text-[14px] leading-snug flex-1 min-w-0 line-clamp-2`}>
            {campaign.name}
          </span>
          <ColorLabel color={status.color}>{status.label}</ColorLabel>
        </span>

        {(dates || businessName) && (
          <span className={`flex items-center gap-1.5 text-[11px] min-w-0 ${faintText}`}>
            {dates && <CalendarDays size={11} className="flex-shrink-0" />}
            {dates && <span className="flex-shrink-0">{dates}</span>}
            {dates && businessName && <span className="opacity-50">·</span>}
            {businessName && <span className="truncate">{businessName}</span>}
          </span>
        )}

        <span className="flex flex-col gap-1">
          {/* Decorative: the button's name already carries the numbers, in
              the line under it. */}
          <ProgressBar value={progress.ratio} color={campaign.color} label={summary} decorative />
          <span className={`text-[11px] tabular-nums ${faintText}`}>
            {progress.planned === 0 ? 'No deliverables planned yet' : summary}
          </span>
        </span>

        {slots.length > 0 && (
          <span className={`text-[11px] leading-relaxed line-clamp-2 ${faintText}`}>
            {slots.map((s) => `${s.deliverable.label} ${s.posted}/${s.planned}`).join(' · ')}
          </span>
        )}
      </span>
    </button>
  );
}
