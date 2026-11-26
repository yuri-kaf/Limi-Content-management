import { Plus } from '../../icons';
import { Business, Campaign, Client, ContentItem } from '../../types';
import { businessIdOf, businessSummary, sortCampaigns } from '../../campaigns';
import { buildToday, todayTotal } from '../../today';
import { STAGES } from '../../utils';
import { QUEUE_SECTIONS, QueueGroup } from '../QueueGroup';
import { stageDot, stageCardVars } from '../../stageColors';
import { enter, staggerStyle } from '../../motion';
import BusinessCard from './BusinessCard';
import CampaignCard from './CampaignCard';
import { viewPad, heading, faintText, sectionLabel, countChip, focusRing } from '../../ui';

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
      <div className={`${viewPad} py-6 flex flex-col gap-7`}>
        {multi && (
          <section aria-label="Businesses" className={enter} style={staggerStyle(0)}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={sectionLabel}>Businesses</span>
              <span className={countChip}>{businesses.length}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
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
                  className={`min-h-[76px] rounded-card bg-raised dark:bg-raised-dark inline-flex items-center justify-center gap-2 text-[13px] font-medium text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors ${focusRing}`}
                >
                  <Plus size={18} />
                  Add business
                </button>
              )}
            </div>
          </section>
        )}

        {/* One count per board stage, each marked with its stage dot. On a
            phone all five share one row (labels only, so each fits whole)
            rather than leaving Backup alone on a second row. */}
        <section
          aria-label="Pipeline"
          className={`grid grid-cols-5 gap-1.5 sm:gap-3 ${enter}`}
          style={staggerStyle(1)}
        >
          {STAGES.map((s) => (
            <div
              key={s.id}
              data-stage={s.id}
              className="min-w-0 rounded-card px-1 py-2.5 sm:px-3.5 sm:py-3 text-center sm:text-left bg-raised dark:bg-raised-dark"
            >
              <span className="flex items-center justify-center sm:justify-start gap-1.5 min-w-0 whitespace-nowrap text-[11px] sm:text-[12px] font-medium text-ink-soft dark:text-ink-softdark">
                <span className={`hidden sm:block w-2 h-2 flex-shrink-0 rounded-full ${stageDot}`} style={stageCardVars(s.id)} />
                <span>{s.label}</span>
              </span>
              <p className={`${heading} text-xl sm:text-2xl mt-1 tabular-nums`}>
                {content.filter((i) => i.status === s.id).length}
              </p>
            </div>
          ))}
        </section>

        <div
          className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-7 items-start ${enter}`}
          style={staggerStyle(2)}
        >
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
                  // Only where rows can come from different businesses: with
                  // one, or scoped to one, every row would repeat the name.
                  showSource={multi && !businessId}
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
