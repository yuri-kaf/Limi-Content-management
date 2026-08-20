import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ContentItem, ContentStatus } from '../types';
import { boardColumn, columnHeader, columnBody, columnAdd, faintText } from '../ui';
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
  label: string;
  color: string;
  items: ContentItem[];
  canAdd: boolean;
  canEditItem: (item: ContentItem) => boolean;
  canDeleteItem: (item: ContentItem) => boolean;
  onAddContent: (status: ContentStatus) => void;
  onCardClick: (item: ContentItem) => void;
  onEditCard: (item: ContentItem) => void;
  onDeleteCard: (item: ContentItem) => void;
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
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className={boardColumn}>
      <div className={columnHeader}>
        <StagePill status={id} />
        <span className={`text-[11px] font-semibold tabular-nums ${faintText}`}>
          {items.length}
        </span>
        {canAdd && (
          <button
            onClick={() => onAddContent(id)}
            className={`${columnAdd} ml-auto`}
            aria-label={`Add to ${id}`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={columnBody}
        // The drop target reads as a tint shift rather than a coloured outline —
        // an outline on four columns at once is noise.
        style={
          isOver
            ? { backgroundColor: 'rgba(120,120,120,0.10)', borderStyle: 'dashed' }
            : undefined
        }
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="flex-1 flex items-start justify-center pt-8 px-3">
              <p className={`text-[11px] leading-relaxed text-center ${faintText}`}>
                {PURPOSE[id]}
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
