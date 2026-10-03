import { Megaphone, Plus } from 'lucide-react';
import { Business, Campaign, ContentItem } from '../../types';
import { CAMPAIGN_GROUP_ORDER, campaignStatusMeta, sortCampaigns } from '../../campaigns';
import CampaignCard from './CampaignCard';
import {
  shellPad, heading, faintText, card, btnPrimary, sectionLabel, countChip,
  emptyState, emptyTitle, emptyBody,
} from '../../ui';

interface Props {
  /** Already scoped to the current business, if there is one. */
  campaigns: Campaign[];
  /** The client's content; each card picks out its own. */
  content: ContentItem[];
  businesses: Business[];
  canManage: boolean;
  onOpen: (campaign: Campaign) => void;
  onNew: () => void;
}

export default function CampaignsTab({ campaigns, content, businesses, canManage, onOpen, onNew }: Props) {
  const sorted = sortCampaigns(campaigns);
  const multi = businesses.length >= 2;
  const nameOf = (id: string) => businesses.find((b) => b.id === id)?.name;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shellPad} max-w-[1100px] py-6`}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1 className={`${heading} text-lg`}>Campaigns</h1>
            <p className={`text-[13px] mt-0.5 ${faintText}`}>
              {campaigns.length === 0
                ? 'Group the content a push needs, and see what is still missing.'
                : `${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'}`}
            </p>
          </div>
          {canManage && (
            <button onClick={onNew} className={`${btnPrimary} h-9 min-h-0 px-3 text-[12px] flex-shrink-0`}>
              <Plus size={14} />
              New campaign
            </button>
          )}
        </div>

        {campaigns.length === 0 ? (
          <div className={emptyState}>
            <div className={`${card} w-12 h-12 flex items-center justify-center`}>
              <Megaphone size={20} className={faintText} />
            </div>
            <p className={emptyTitle}>No campaigns yet</p>
            <p className={emptyBody}>
              A campaign is a launch, a season or a promotion: a brief, a date range, and the
              pieces of content it needs.
            </p>
          </div>
        ) : (
          CAMPAIGN_GROUP_ORDER.map((status) => {
            const group = sorted.filter((c) => c.status === status);
            if (group.length === 0) return null;
            const meta = campaignStatusMeta(status);
            return (
              <section key={status} aria-label={meta.label} className="mb-7">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <span className={sectionLabel}>{meta.label}</span>
                  <span className={countChip}>{group.length}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {group.map((c) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      content={content}
                      businessName={multi ? nameOf(c.businessId) : undefined}
                      onOpen={() => onOpen(c)}
                    />
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
