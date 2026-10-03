import { Plus } from 'lucide-react';
import { Business, Campaign, Client, ContentItem } from '../../types';
import { businessIdOf, businessSummary, sortCampaigns } from '../../campaigns';
import { buildToday, todayTotal } from '../../today';
import { STAGES } from '../../utils';
import { QUEUE_SECTIONS, QueueGroup } from '../QueueGroup';
import StagePill from '../StagePill';
import BusinessCard from './BusinessCard';
import CampaignCard from './CampaignCard';
import { shell, heading, faintText, tile, sectionLabel, countChip } from '../../ui';

interface Props {
  client: Client;
  /** The client's content, scoped to the current business if there is one. */
  content: ContentItem[];
  /** Campaigns, scoped the same way. */
  campaigns: Campaign[];
  /** Every campaign of the client, for the business cards' counts. */
  allCampaigns: Campaign[];
  businessId: string | undefined;
  canManage: boolean;
  onSelectBusiness: (businessId: string | undefined) => void;
  onEditBusiness: (business: Business) => void;
  onAddBusiness: () => void;
  onOpenItem: (item: ContentItem) => void;
  onOpenCampaign: (campaign: Campaign) => void;
}

// The tab that answers "how is this client doing?" without opening anything:
// which business, what stage everything is at, what is waiting, what is running.
export default function OverviewTab({
  client, content, campaigns, allCampaigns, businessId, canManage,
  onSelectBusiness, onEditBusiness, onAddBusiness, onOpenItem, onOpenCampaign,
}: Props) {
  const businesses = client.businesses;
  const multi = businesses.length >= 2;
  const now = Date.now();

  // Today's queue, reused. With several businesses each row names its business
  // rather than the client, whose name would be the same on every row.
  const sources: Client[] = multi
    ? businesses.map((b) => ({
        ...client,
        name: b.name,
        imageUrl: b.logoUrl,
        color: b.color,
        content: content.filter((i) => businessIdOf(i, businesses) === b.id),
      }))
    : [{ ...client, content }];
  const groups = buildToday(sources, now);
  const waiting = todayTotal(groups);

  const active = sortCampaigns(campaigns.filter((c) => c.status !== 'completed'));
  // Only worth saying whose campaign it is when the view spans businesses.
  const businessName = (id: string) =>
    multi && !businessId ? businesses.find((b) => b.id === id)?.name : undefined;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6 max-w-[1100px] flex flex-col gap-7`}>
        {multi && (
          <section aria-label="Businesses">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={sectionLabel}>Businesses</span>
              <span className={countChip}>{businesses.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {businesses.map((b) => (
                <BusinessCard
                  key={b.id}
                  business={b}
                  summary={businessSummary(b.id, businesses, client.content, allCampaigns)}
                  selected={businessId === b.id}
                  canManage={canManage}
                  // Pressing the business already in scope widens back to all.
                  onSelect={() => onSelectBusiness(businessId === b.id ? undefined : b.id)}
                  onEdit={() => onEditBusiness(b)}
                />
              ))}
              {canManage && (
                <button
                  onClick={onAddBusiness}
                  className="min-h-[76px] rounded-card border border-dashed border-hairline dark:border-hairline-dark inline-flex items-center justify-center gap-2 text-[13px] font-medium text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-tint dark:hover:bg-tint-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  <Plus size={15} />
                  Add business
                </button>
              )}
            </div>
          </section>
        )}

        <section aria-label="Pipeline" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAGES.map((s) => (
            <div key={s.id} className={`${tile} p-3.5`}>
              <StagePill status={s.id} />
              <p className={`${heading} text-2xl mt-2 tabular-nums`}>
                {content.filter((i) => i.status === s.id).length}
              </p>
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-7 items-start">
          <div>
            {waiting === 0 ? (
              <p className={`px-1 text-[13px] ${faintText}`}>
                Nothing needs attention: no review waiting, nothing declined, nothing due this week.
              </p>
            ) : (
              QUEUE_SECTIONS.map((section) => (
                <QueueGroup
                  key={section.id}
                  section={section}
                  entries={groups[section.key]}
                  now={now}
                  onOpen={(entry) => onOpenItem(entry.item)}
                  // With one business every row would name the client again.
                  showSource={multi}
                />
              ))
            )}
          </div>

          <section aria-label="Active campaigns">
            <div className="flex items-center gap-2 mb-1.5 px-1">
              <span className={sectionLabel}>Active campaigns</span>
              <span className={countChip}>{active.length}</span>
            </div>
            {active.length === 0 ? (
              <p className={`px-1 text-[12px] ${faintText}`}>
                Nothing planned or live{canManage ? '. Start one from the Campaigns tab.' : '.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {active.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    content={client.content}
                    businessName={businessName(c.businessId)}
                    onOpen={() => onOpenCampaign(c)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
