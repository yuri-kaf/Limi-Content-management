import { useState } from 'react';
import { ArrowLeft, LayoutGrid, ListChecks, Pencil, Plus } from 'lucide-react';
import { Business, Campaign, CampaignStatus, ContentItem, ContentStatus } from '../../types';
import {
  CAMPAIGN_STATUSES, DeliverableProgress, campaignProgress, campaignStatusMeta,
  deliverableProgress, formatDateRange, unslottedContent,
} from '../../campaigns';
import { folderColor } from '../../folderColors';
import ColorLabel from '../ColorLabel';
import ProgressBar from '../ProgressBar';
import StagePill from '../StagePill';
import ContentBoard from './ContentBoard';
import {
  shell, heading, faintText, sectionLabel, readout, rowList, segmented, segItem,
  btnGhost, toolbarSelect,
} from '../../ui';

interface Props {
  campaign: Campaign;
  /** The client's content; the page picks out the campaign's own. */
  content: ContentItem[];
  businesses: Business[];
  /** Every campaign of the client, for the board's card labels. */
  campaigns: Campaign[];
  canManage: boolean;
  canEditItem: (item: ContentItem) => boolean;
  canDeleteItem: (item: ContentItem) => boolean;
  onBack: () => void;
  onEdit: () => void;
  onSetStatus: (status: CampaignStatus) => void;
  onOpenItem: (item: ContentItem) => void;
  /** Opens the add-content form already filed under this campaign. */
  onAddContent: (defaults: { status: ContentStatus; deliverableId?: string }) => void;
  onEditItem: (item: ContentItem) => void;
  onMoveItem: (item: ContentItem, status: ContentStatus) => void;
}

// A content item as a chip: stage first, because "which stage is each of the
// three reels at" is the question this page is opened to answer.
function ItemChip({ item, onOpen }: { item: ContentItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="inline-flex items-center gap-1.5 h-7 max-w-[260px] pl-0.5 pr-2 rounded-tile border border-hairline dark:border-hairline-dark bg-canvas dark:bg-canvas-dark hover:bg-hover dark:hover:bg-hover-dark text-[12px] text-ink dark:text-ink-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <StagePill status={item.status} />
      <span className="truncate">{item.title}</span>
    </button>
  );
}

function DeliverableRow({
  slot, color, canAdd, onOpenItem, onAdd,
}: {
  slot: DeliverableProgress;
  color: string;
  canAdd: boolean;
  onOpenItem: (item: ContentItem) => void;
  onAdd: () => void;
}) {
  const { deliverable, items, posted, planned } = slot;
  const toMake = Math.max(0, deliverable.target - items.length);
  return (
    <div className="px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-ink dark:text-ink-dark">
          {deliverable.label}
          {deliverable.mediaType && (
            <span className={`ml-1.5 text-[11px] font-normal ${faintText}`}>
              {deliverable.mediaType === 'video' ? 'Video' : 'Graphic'}
            </span>
          )}
        </span>
        <span className={`text-[12px] tabular-nums ${faintText}`}>
          {`${posted}/${planned} posted`}
        </span>
      </div>
      <ProgressBar
        value={posted / planned}
        color={color}
        label={`${deliverable.label}: ${posted} of ${planned} posted`}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {items.map((i) => (
          <ItemChip key={i.id} item={i} onOpen={() => onOpenItem(i)} />
        ))}
        {canAdd && toMake > 0 && (
          <>
            <button
              onClick={onAdd}
              aria-label={`Add to ${deliverable.label}`}
              className="inline-flex items-center gap-1 h-7 px-2 rounded-tile border border-dashed border-hairline dark:border-hairline-dark text-[12px] text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
            >
              <Plus size={12} />
              Add
            </button>
            <span className={`text-[11px] ${faintText}`}>{toMake} still to make</span>
          </>
        )}
      </div>
    </div>
  );
}

export default function CampaignPage({
  campaign, content, businesses, canManage, canEditItem, canDeleteItem,
  onBack, onEdit, onSetStatus, onOpenItem, onAddContent, onEditItem, onMoveItem,
}: Props) {
  // Plan first: the checklist is what this page adds. The board is the same
  // kanban as the Content tab, narrowed to this campaign, at full height.
  const [view, setView] = useState<'plan' | 'board'>('plan');

  const own = content.filter((i) => i.campaignId === campaign.id);
  const progress = campaignProgress(campaign, content);
  const slots = deliverableProgress(campaign, content);
  const loose = unslottedContent(campaign, content);
  const status = campaignStatusMeta(campaign.status);
  const summary = `${progress.posted} of ${progress.planned} posted`;
  const business =
    businesses.length >= 2 ? businesses.find((b) => b.id === campaign.businessId) : undefined;
  const subtitle =
    [formatDateRange(campaign.startDate, campaign.endDate), business?.name].filter(Boolean).join(' · ') ||
    'No dates set';

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 border-b border-hairline dark:border-hairline-dark px-4 pt-3 pb-2.5 flex flex-col gap-2.5">
        <button
          onClick={onBack}
          className={`self-start inline-flex items-center gap-1 text-[12px] font-medium ${faintText} hover:text-ink dark:hover:text-ink-dark transition-colors`}
        >
          <ArrowLeft size={13} />
          Campaigns
        </button>

        <div className="flex items-start gap-3 flex-wrap">
          <span
            className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
            style={{ backgroundColor: folderColor(campaign.color).swatch }}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <h1 className={`${heading} text-lg leading-snug`}>{campaign.name}</h1>
            <p className={`text-[12px] mt-0.5 ${faintText}`}>{subtitle}</p>
          </div>
          {canManage ? (
            <select
              aria-label="Status"
              value={campaign.status}
              onChange={(e) => onSetStatus(e.target.value as CampaignStatus)}
              className={toolbarSelect}
            >
              {CAMPAIGN_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          ) : (
            <ColorLabel color={status.color}>{status.label}</ColorLabel>
          )}
          {canManage && (
            <button onClick={onEdit} className={`${btnGhost} h-9 min-h-0 px-3 text-[12px]`}>
              <Pencil size={13} />
              Edit
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 max-w-md">
          <ProgressBar value={progress.ratio} color={campaign.color} label={summary} />
          <span className={`text-[12px] tabular-nums whitespace-nowrap ${faintText}`}>{summary}</span>
        </div>

        <div className={`${segmented} self-start`}>
          <button onClick={() => setView('plan')} aria-pressed={view === 'plan'} className={segItem(view === 'plan')}>
            <ListChecks size={13} />
            Plan
          </button>
          <button onClick={() => setView('board')} aria-pressed={view === 'board'} className={segItem(view === 'board')}>
            <LayoutGrid size={13} />
            Board
            <span className="tabular-nums opacity-70">{own.length}</span>
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <ContentBoard
          content={own}
          // No campaigns: every card here is in this one, so a label on each
          // would repeat the page title.
          campaigns={[]}
          businesses={businesses}
          isClientRole={false}
          canAdd={canManage}
          canEditItem={canEditItem}
          canDeleteItem={canDeleteItem}
          onOpen={onOpenItem}
          onAdd={(s) => onAddContent({ status: s })}
          onEdit={onEditItem}
          onMove={onMoveItem}
        />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`${shell} py-6 max-w-[820px] flex flex-col gap-6`}>
            <section aria-label="Brief">
              <h2 className={`${sectionLabel} mb-1.5`}>Brief</h2>
              {campaign.brief ? (
                <p className={readout}>{campaign.brief}</p>
              ) : (
                <p className={`text-[13px] ${faintText}`}>
                  No brief yet.{canManage ? ' Add one with Edit.' : ''}
                </p>
              )}
            </section>

            <section aria-label="Deliverables">
              <h2 className={`${sectionLabel} mb-1.5`}>Deliverables</h2>
              {slots.length === 0 ? (
                <p className={`text-[13px] ${faintText}`}>
                  Nothing planned yet.
                  {canManage
                    ? ' List what this campaign needs — 3 Reels, 2 carousels — with Edit, and progress fills in as content is linked.'
                    : ''}
                </p>
              ) : (
                <div className={rowList}>
                  {slots.map((s) => (
                    <DeliverableRow
                      key={s.deliverable.id}
                      slot={s}
                      color={campaign.color}
                      canAdd={canManage}
                      onOpenItem={onOpenItem}
                      onAdd={() => onAddContent({ status: 'editing', deliverableId: s.deliverable.id })}
                    />
                  ))}
                </div>
              )}
            </section>

            {loose.length > 0 && (
              <section aria-label="Also in this campaign">
                <h2 className={`${sectionLabel} mb-1.5`}>Also in this campaign</h2>
                <div className="flex flex-wrap gap-1.5">
                  {loose.map((i) => (
                    <ItemChip key={i.id} item={i} onOpen={() => onOpenItem(i)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
