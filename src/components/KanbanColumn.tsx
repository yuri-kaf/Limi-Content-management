import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { ContentItem, ContentStatus } from '../types';
import ContentCard from './ContentCard';

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
  label,
  color,
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
    <div className="flex flex-col min-w-0 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-neutral-700 dark:text-[#d0d0d0]">{label}</span>
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ color, backgroundColor: `${color}1a` }}
          >
            {items.length}
          </span>
        </div>
        {canAdd && (
          <button
            onClick={() => onAddContent(id)}
            className="w-6 h-6 rounded-md flex items-center justify-center text-neutral-300 dark:text-[#333] hover:text-neutral-600 dark:hover:text-[#777] hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors"
            aria-label={`Add to ${label}`}
          >
            <Plus size={14} />
          </button>
        )}
      </div>

      {/* Top accent line + drop zone */}
      <div className="flex flex-col flex-1">
        <div className="h-px rounded-full mb-2.5 transition-all duration-150" style={{ backgroundColor: isOver ? color : `${color}30` }} />

        <div
          ref={setNodeRef}
          className="flex flex-col gap-2.5 flex-1 min-h-[220px] rounded-xl p-2.5 transition-all duration-150 bg-neutral-100 dark:bg-[#0d0d0d] border border-neutral-200 dark:border-[#181818]"
          style={isOver ? { backgroundColor: `${color}08`, border: `1px solid ${color}35` } : undefined}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.length === 0 ? (
              <div
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg py-12"
                style={{ border: `1px dashed ${color}18` }}
              >
                <div className="w-2 h-2 rounded-full opacity-20" style={{ backgroundColor: color }} />
                <span className="text-xs text-neutral-300 dark:text-[#2e2e2e]">Drop here</span>
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

          {items.length > 0 && canAdd && (
            <button
              onClick={() => onAddContent(id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-neutral-300 dark:text-[#333] hover:text-neutral-500 dark:hover:text-[#666] hover:bg-neutral-200 dark:hover:bg-[#181818] transition-colors text-xs font-medium border border-dashed border-neutral-200 dark:border-[#1c1c1c] hover:border-neutral-300 dark:hover:border-[#2c2c2c]"
            >
              <Plus size={12} />
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
