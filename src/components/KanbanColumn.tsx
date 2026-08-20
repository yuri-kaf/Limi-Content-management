import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ContentItem, ContentStatus } from '../types';
import {
  boardColumn, columnHeader, columnBody, columnBodyOver, columnBodyPlain, columnAdd,
  countChip, faintText,
} from '../ui';
import ContentCard from './ContentCard';
import StagePill from './StagePill';

// What each stage is actually for. An empty column that explains itself teaches
// the workflow; one that says "Nothing here yet" teaches nothing.
const PURPOSE: Record<ContentStatus, string> = {
  editing: 'Work in progress. Drop something here while it is still being cut.',
  review: 'Waiting on the client. Items here are asking for a decision.',
  'to-post': 'Approved and scheduled. Ready to go out.',
  posted: 'Published. Kept for the record.',
};

interface Props {
  id: ContentStatus;
  items: ContentItem[];
  canAdd: boolean;
  canEditItem: (item: ContentItem) => boolean;
  canDeleteItem: (item: ContentItem) => boolean;
  onAddContent: (status: ContentStatus) => void;
  onCardClick: (item: ContentItem) => void;
  onEditCard: (item: ContentItem) => void;
  onDeleteCard: (item: ContentItem) => void;
  /** True when a filter is narrowing the board, which changes what "empty" means. */
  filtered?: boolean;
  /**
   * 'column' is one of four fixed-width columns on the desktop board. 'single'
   * is the whole width on a phone, where the stage tabs above already carry the
   * stage's name and count — so this variant drops the header rather than
   * repeating both.
   */
  layout?: 'column' | 'single';
}

export default function KanbanColumn({
  id,
  items,
  canAdd,
  canEditItem,
  canDeleteItem,
  onAddContent,
  onCardClick,
  onEditCard,
  onDeleteCard,
  filtered = false,
  layout = 'column',
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const single = layout === 'single';

  return (
    <div className={single ? 'flex-1 min-h-0 flex flex-col' : boardColumn}>
      {!single && (
        <div className={columnHeader}>
          <StagePill status={id} />
          {/* A counter chip, not a bare grey number: "Editing 16" set in one
              colour at one size read as a single label. */}
          <span className={countChip}>{items.length}</span>
          {canAdd && (
            <button
              onClick={() => onAddContent(id)}
              className={`${columnAdd} ml-auto`}
              aria-label={`Add to ${id}`}
            >
              <Plus size={15} />
            </button>
          )}
        </div>
      )}

      <div
        ref={setNodeRef}
        // The drop target reads as a tint shift rather than a coloured outline —
        // an outline on four columns at once is noise.
        className={`${single ? columnBodyPlain : columnBody} ${isOver && !single ? columnBodyOver : ''}`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="flex-1 flex items-start justify-center pt-8 px-4">
              <p className={`text-[12px] leading-relaxed text-center max-w-[26ch] ${faintText}`}>
                {filtered ? 'Nothing here matches the current filter.' : PURPOSE[id]}
              </p>
            </div>
          ) : (
            items.map((item) => (
              <ContentCard
                key={item.id}
                item={item}
                onCardClick={() => onCardClick(item)}
                onEdit={canEditItem(item) ? () => onEditCard(item) : undefined}
                onDelete={canDeleteItem(item) ? () => onDeleteCard(item) : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
