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
  onAddContent: (status: ContentStatus) => void;
}

export default function KanbanColumn({ id, label, color, items, onAddContent }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col min-w-0 w-full">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-white">{label}</span>
          <span className="text-xs font-medium text-[#888] bg-[#222] px-1.5 py-0.5 rounded-md">
            {items.length}
          </span>
        </div>
      </div>

      <div
        ref={setNodeRef}
        className="flex flex-col gap-3 flex-1 min-h-[120px] rounded-xl p-2 transition-colors duration-150"
        style={{
          backgroundColor: isOver ? '#1a1a2e' : '#141414',
          border: isOver ? '1px solid #6366f1' : '1px solid #1e1e1e',
        }}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-dashed border-[#2a2a2a] rounded-lg py-8">
              <span className="text-xs text-[#444]">No content yet</span>
            </div>
          ) : (
            items.map((item) => <ContentCard key={item.id} item={item} />)
          )}
        </SortableContext>

        <button
          onClick={() => onAddContent(id)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[#555] hover:text-[#888] hover:bg-[#222] transition-colors text-xs font-medium border border-dashed border-[#2a2a2a] hover:border-[#3a3a3a]"
        >
          <Plus size={13} />
          Add
        </button>
      </div>
    </div>
  );
}
