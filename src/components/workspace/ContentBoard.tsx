import { useEffect, useRef, useState } from 'react';
import {
  Announcements,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  Over,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  DragStartEvent,
  DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Business, Campaign, ContentItem, ContentStatus } from '../../types';
import KanbanColumn from '../KanbanColumn';
import CampaignOptions from '../CampaignOptions';
import ContentCard from '../ContentCard';
import { stageCardVars, stageDot } from '../../stageColors';
import StageTabs from '../StageTabs';
import BoardFilters from '../BoardFilters';
import { useIsDesktop, useMediaQuery } from '../../hooks/useMediaQuery';
import { STAGES } from '../../utils';
import { NO_CAMPAIGN, scopeContent } from '../../campaigns';
import { ContentFilters, NO_FILTERS, activeFilterCount, filterContent } from '../../filters';
import {
  boardScroller, boardRow, boardColumn, boardSingle, columnHeader, columnBody,
  columnBodyPlain, countChip, pageToolbar, faintText, btnPrimary, toolbarSelect,
} from '../../ui';

// `tab` is the short form for the phone tab strip, where four labels share the
// width. The long label is what the column header shows.
interface StageDef {
  id: ContentStatus;
  label: string;
  tab: string;
}

const TEAM_STAGES: StageDef[] = STAGES.map((s) => ({ id: s.id, label: s.label, tab: s.label }));

// Each stage as its column header names it, for what a screen reader is told.
const STAGE_LABELS = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<ContentStatus, string>;

// Clients see three stages — 'editing' is internal — and the labels are written
// from their point of view rather than the team's.
const CLIENT_STAGES: StageDef[] = [
  { id: 'review', label: 'Needs your review', tab: 'Your review' },
  { id: 'to-post', label: 'Ready to post', tab: 'Ready' },
  { id: 'posted', label: 'Posted', tab: 'Posted' },
];

const CLIENT_PURPOSE: Record<string, string> = {
  review: 'Nothing is waiting on you right now.',
  'to-post': 'Nothing approved and waiting to go out.',
  posted: 'Nothing has been published yet.',
};

// Read out as the description of every card that can be moved. dnd-kit's own
// text never mentions opening a card, which is what Enter does here.
const SCREEN_READER_INSTRUCTIONS = {
  draggable:
    'Press Enter to open this item. To move it to another stage, press Space to pick it up, ' +
    'the left and right arrow keys to carry it to a stage, and Space again to drop it there. ' +
    'Escape puts it back.',
};

// A client's board is read-only, so it needs no droppable and no sortable —
// same column shell, none of the drag machinery. That includes the cards: a
// card that registers as sortable is one the keyboard sensor will lift, and a
// client pressing Space lifted theirs into a drag with nowhere to land.
function ReadOnlyColumn({
  status,
  label,
  items,
  onCardClick,
  campaignOf,
  filtered = false,
  layout = 'column',
}: {
  status: ContentStatus;
  label: string;
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
  campaignOf: (item: ContentItem) => Campaign | undefined;
  filtered?: boolean;
  layout?: 'column' | 'single';
}) {
  const single = layout === 'single';
  return (
    <div className={single ? 'flex-1 min-h-0 flex flex-col' : boardColumn}>
      {!single && (
        <div className={columnHeader}>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${stageDot}`}
            style={stageCardVars(status)}
            aria-hidden="true"
          />
          <span className="text-[13px] font-medium text-ink dark:text-ink-dark truncate">{label}</span>
          <span className={`${countChip} ml-auto`}>{items.length}</span>
        </div>
      )}
      <div className={single ? columnBodyPlain : columnBody}>
        {items.length === 0 ? (
          <div className="flex-1 flex items-start justify-center pt-8 px-4">
            <p className={`text-[12px] leading-relaxed text-center max-w-[26ch] ${faintText}`}>
              {filtered
                ? 'Nothing here matches the current filter.'
                : CLIENT_PURPOSE[status] ?? 'Nothing here right now.'}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ContentCard
              key={item.id}
              item={item}
              campaign={campaignOf(item)}
              onCardClick={() => onCardClick(item)}
              draggable={false}
            />
          ))
        )}
      </div>
    </div>
  );
}

// The dropped card settles into its slot instead of snapping, while the gap it
// left stays faint until it lands. `settling` on the overlay lets ContentCard
// straighten its tilt over the same moment. Off for anyone who asked for less
// motion: dnd-kit animates in JavaScript, which the CSS rule in index.css
// cannot reach.
const DROP_ANIMATION: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(.2,.8,.2,1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.25' } },
    className: { dragOverlay: 'settling' },
  }),
};

// What the drag copy's actions do. The copy is never pressed; it carries them
// only to take up the room they take up on the card.
const doNothing = () => {};

interface Props {
  /** Already scoped to the business or campaign being viewed. */
  content: ContentItem[];
  /** The campaigns this content can belong to, for card labels and the filter. */
  campaigns: Campaign[];
  /** Groups the filter's campaigns by business when there are several. */
  businesses: Business[];
  isClientRole: boolean;
  canAdd: boolean;
  canEditItem: (item: ContentItem) => boolean;
  canDeleteItem: (item: ContentItem) => boolean;
  /** Offer the campaign filter. Off inside a campaign, where it has one answer. */
  campaignFilter?: boolean;
  onOpen: (item: ContentItem) => void;
  /** The campaign is set when the board is filtered to one, so new content lands in it. */
  onAdd: (status: ContentStatus, campaignId?: string) => void;
  onEdit: (item: ContentItem) => void;
  /**
   * Moves a card to another stage. A returned promise tells the board when
   * the write has finished; until then the card is drawn where it was dropped.
   */
  onMove: (item: ContentItem, status: ContentStatus) => Promise<unknown> | void;
}

export default function ContentBoard({
  content, campaigns, businesses, isClientRole, canAdd, canEditItem, canDeleteItem,
  campaignFilter = false, onOpen, onAdd, onEdit, onMove,
}: Props) {
  const [filters, setFilters] = useState<ContentFilters>(NO_FILTERS);
  // The campaign the person picked. The filter actually applied is worked out
  // below, because the campaigns on offer change underneath it: another
  // business in scope, or a teammate deleting the campaign.
  const [picked, setPicked] = useState('');
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  // The stage the carried card is over. The copy in the hand takes its fill,
  // so the copy the drop animation settles is already the colour it lands in.
  const [overStage, setOverStage] = useState<ContentStatus | null>(null);
  // Moves made on this board that `content` does not show yet, by item id. A
  // move reaches `content` only when the database echoes it back, a tick
  // after the drop, but the drop's own render is when dnd-kit measures where
  // the card lands and when it gives keyboard focus back. A card still in its
  // old column drew the settling copy back there, and when it moved a moment
  // later it was unmounted from under the focus. So a dropped card is drawn in
  // its new column at once, until `content` shows the move or the write ends.
  const [pending, setPending] = useState<Record<string, ContentStatus>>({});
  // The stage the live region last named for the card being carried.
  const spokenStage = useRef<ContentStatus | null>(null);
  const [activeStage, setActiveStage] = useState<ContentStatus>(
    isClientRole ? 'review' : 'editing'
  );
  // Must match the condition that renders the draggable board. Gating the
  // handlers more narrowly than the UI is how drag came to look simply dead.
  const canMove = !isClientRole;
  // Captured once per render so a filtered view cannot shift mid-interaction.
  const now = Date.now();
  const showCampaignFilter = campaignFilter && campaigns.length > 0;
  // '' is every campaign; NO_CAMPAIGN is the content outside all of them. A
  // pick that is no longer on offer lets go, rather than filtering the board
  // down to nothing behind a select that cannot show the reason.
  const campaignId =
    showCampaignFilter && (picked === NO_CAMPAIGN || campaigns.some((c) => c.id === picked))
      ? picked
      : '';
  const isFiltered = activeFilterCount(filters) > 0 || campaignId !== '';
  // Content added while the board is filtered to one campaign is filed under
  // it; otherwise the new card would vanish from the view it was added in.
  const filedCampaign = campaignId && campaignId !== NO_CAMPAIGN ? campaignId : undefined;

  // Below lg the board is a tab strip over one full-width column. Chosen in JS
  // rather than CSS because the two layouts cannot both be mounted: each
  // registers the same droppable and sortable ids.
  const isDesktop = useIsDesktop();
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Without this the board is unusable without a pointer. Space lifts a
    // card; Enter opens it, and the card keeps that key from the sensor.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // An entry has done its job once `content` shows the move. Kept any longer,
  // it would hide whatever happens to the card next, such as a teammate
  // moving it on.
  useEffect(() => {
    setPending((moves) => {
      const left = Object.entries(moves).filter(
        ([id, status]) => content.find((item) => item.id === id)?.status !== status
      );
      return left.length === Object.keys(moves).length ? moves : Object.fromEntries(left);
    });
  }, [content]);

  // The content as the board draws it, each card in the stage of any move of
  // it still on its way. Everything below reads this rather than `content`, so
  // the columns, their counts, the drop targets and what a screen reader hears
  // all agree on where a card is, and a card takes its new stage's fill.
  const placed = content.map((item) => {
    const status = pending[item.id];
    return status && status !== item.status ? { ...item, status } : item;
  });

  const campaignOf = (item: ContentItem) =>
    item.campaignId ? campaigns.find((c) => c.id === item.campaignId) : undefined;
  const shown = campaignId ? scopeContent(placed, { campaignId }, [], campaigns) : placed;

  function itemsIn(status: ContentStatus): ContentItem[] {
    const inStage = shown.filter((item) => item.status === status);
    return filterContent(inStage, filters, now).sort((a, b) => a.createdAt - b.createdAt);
  }

  const itemWithId = (id: UniqueIdentifier) => placed.find((c) => c.id === id);

  function handleDragStart(event: DragStartEvent) {
    if (!canMove) return;
    const item = itemWithId(event.active.id);
    if (item) setActiveItem(item);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!canMove) return;
    setOverStage(event.over ? resolveDropStatus(event.over.id as string) : null);
  }

  function endDrag() {
    setActiveItem(null);
    setOverStage(null);
  }

  // The drop target is either a column or one of the cards inside it, since
  // collision detection reports whichever is closest.
  function resolveDropStatus(overId: string): ContentStatus | null {
    const column = TEAM_STAGES.find((col) => col.id === overId);
    if (column) return column.id;
    return itemWithId(overId)?.status ?? null;
  }

  // The stage a drop sends a card to, or null when it stays where it is. The
  // move and what a screen reader is told about it both ask this, so the two
  // cannot disagree.
  function destination(item: ContentItem, over: Over | null): ContentStatus | null {
    const target = over ? resolveDropStatus(over.id as string) : null;
    return target && target !== item.status ? target : null;
  }

  // Committing on drag-over used to look like a live move, but each commit
  // reordered the board under the cursor, which fired another drag-over and
  // committed again. The move belongs on drop; the hover highlight comes from
  // useDroppable's own isOver and needs no state write.
  function handleDragEnd(event: DragEndEvent) {
    endDrag();
    if (!canMove) return;
    const item = itemWithId(event.active.id);
    const target = item && destination(item, event.over);
    if (!item || !target) return;
    const write = onMove(item, target);
    // Without a promise nothing would ever say the write had failed, and the
    // card could be left drawn where it never went. It waits for `content`.
    if (!write) return;
    setPending((moves) => ({ ...moves, [item.id]: target }));
    // runWrite resolves false on a failed write rather than rejecting, so this
    // is also what puts a card whose move was refused back where it came from.
    write.finally(() => settle(item.id, target));
  }

  // Lets go of a move once its write has finished, unless the card has been
  // dropped somewhere else in the meantime.
  function settle(id: string, status: ContentStatus) {
    setPending((moves) => {
      if (moves[id] !== status) return moves;
      const rest = { ...moves };
      delete rest[id];
      return rest;
    });
  }

  // What a screen reader hears while a card is carried. dnd-kit's defaults
  // read out ids, which here are Firestore keys: "Draggable item xK9fQ2 was
  // moved over droppable area xK9fQ2". These name the card by its title and
  // the stage by its label. A stage is named only when it changes: dnd-kit
  // reports the card as over its own spot as soon as it is lifted, which cut
  // "Picked up" short, and every step between the cards of one column would
  // name the same stage again.
  const announcements: Announcements = {
    onDragStart({ active }) {
      const item = itemWithId(active.id);
      if (!item) return undefined;
      spokenStage.current = item.status;
      return `Picked up ${item.title} from ${STAGE_LABELS[item.status]}.`;
    },
    onDragOver({ active, over }) {
      const item = itemWithId(active.id);
      const stage = over ? resolveDropStatus(over.id as string) : null;
      if (!item || stage === spokenStage.current) return undefined;
      spokenStage.current = stage;
      return stage
        ? `${item.title} is over ${STAGE_LABELS[stage]}.`
        : `${item.title} is not over a stage.`;
    },
    onDragEnd({ active, over }) {
      const item = itemWithId(active.id);
      if (!item) return undefined;
      const target = destination(item, over);
      return target
        ? `Moved ${item.title} from ${STAGE_LABELS[item.status]} to ${STAGE_LABELS[target]}.`
        : `${item.title} stays in ${STAGE_LABELS[item.status]}.`;
    },
    onDragCancel({ active }) {
      const item = itemWithId(active.id);
      return item && `${item.title} was put back in ${STAGE_LABELS[item.status]}.`;
    },
  };

  const stages = isClientRole ? CLIENT_STAGES : TEAM_STAGES;
  // A stage the current role cannot see must not leave the phone board showing
  // nothing with no tab selected.
  const currentStage = stages.some((s) => s.id === activeStage) ? activeStage : stages[0].id;
  const tabs = stages.map((s) => ({ id: s.id, label: s.tab, count: itemsIn(s.id).length }));

  function column(stage: StageDef, layout: 'column' | 'single') {
    if (isClientRole) {
      return (
        <ReadOnlyColumn
          key={stage.id}
          status={stage.id}
          label={stage.label}
          items={itemsIn(stage.id)}
          onCardClick={onOpen}
          campaignOf={campaignOf}
          filtered={isFiltered}
          layout={layout}
        />
      );
    }
    return (
      <KanbanColumn
        key={stage.id}
        id={stage.id}
        items={itemsIn(stage.id)}
        canAdd={canAdd}
        canEditItem={canEditItem}
        canDeleteItem={canDeleteItem}
        onAddContent={(status) => onAdd(status, filedCampaign)}
        onCardClick={onOpen}
        onEditCard={onEdit}
        // Deleting happens in the detail sheet, where it can be confirmed.
        onDeleteCard={onOpen}
        campaignOf={campaignOf}
        filtered={isFiltered}
        // The phone layout mounts this one column alone, so a card lifted in
        // it could only be dropped back where it started. Its cards stay put
        // instead, and the detail sheet's stage picker moves them.
        draggable={layout === 'column'}
        layout={layout}
      />
    );
  }

  const current = stages.find((s) => s.id === currentStage) ?? stages[0];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className={pageToolbar}>
        <div className="ml-auto flex items-center gap-1.5 min-w-0">
          {showCampaignFilter && (
            <select
              aria-label="Campaign"
              value={campaignId}
              onChange={(e) => setPicked(e.target.value)}
              className={toolbarSelect}
            >
              <option value="">All campaigns</option>
              <option value={NO_CAMPAIGN}>No campaign</option>
              <CampaignOptions campaigns={campaigns} businesses={businesses} />
            </select>
          )}
          <BoardFilters value={filters} onChange={setFilters} />
        </div>
        {canAdd && (
          <button
            onClick={() => onAdd(isDesktop ? 'editing' : currentStage, filedCampaign)}
            className={`${btnPrimary} h-9 min-h-0 px-3 text-[12px] flex-shrink-0`}
          >
            <Plus size={14} />
            New
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={endDrag}
      >
        {isDesktop ? (
          <div className={boardScroller}>
            <div className={boardRow}>{stages.map((s) => column(s, 'column'))}</div>
          </div>
        ) : (
          <>
            <StageTabs tabs={tabs} active={currentStage} onChange={setActiveStage} />
            <div className={boardSingle}>{column(current, 'single')}</div>
          </>
        )}

        <DragOverlay dropAnimation={reduceMotion ? null : DROP_ANIMATION}>
          {/* A plain box around the card: dnd-kit measures the overlay's child,
              transforms included, to place the drop. Measured on the tilted,
              enlarged card it would land a few pixels off its slot and then
              jump; measured on this box it lands exactly. */}
          {activeItem ? (
            <div>
              <ContentCard
                item={overStage ? { ...activeItem, status: overStage } : activeItem}
                campaign={campaignOf(activeItem)}
                // The card's own actions, as handlers that do nothing: the
                // title then wraps at the card's width, so the copy is the
                // card's height and lands without a jump. ContentCard keeps
                // them out of sight on the copy.
                onEdit={canEditItem(activeItem) ? doNothing : undefined}
                onDelete={canDeleteItem(activeItem) ? doNothing : undefined}
                isOverlay
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
