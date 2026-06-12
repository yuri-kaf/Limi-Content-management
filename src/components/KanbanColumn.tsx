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
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold text-[#d0d0d0]">{label}</span>
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md tabular-nums"
            style={{ color, backgroundColor: `${color}1a` }}
          >
            {items.length}
          </span>
        </div>
        <button
          onClick={() => onAddContent(id)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#333] hover:text-[#777] hover:bg-[#1a1a1a] transition-colors"
          aria-label={`Add to ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>

      {/* Top accent line + drop zone */}
      <div className="flex flex-col flex-1">
        {/* Colored accent bar at top */}
        <div className="h-px rounded-full mb-2.5 transition-all duration-150" style={{ backgroundColor: isOver ? color : `${color}30` }} />

        <div
          ref={setNodeRef}
          className="flex flex-col gap-2.5 flex-1 min-h-[220px] rounded-xl p-2.5 transition-all duration-150"
          style={{
            backgroundColor: isOver ? `${color}08` : '#0d0d0d',
            border: isOver ? `1px solid ${color}35` : '1px solid #181818',
          }}
        >
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.length === 0 ? (
              <div
                className="flex-1 flex flex-col items-center justify-center gap-2 rounded-lg py-12"
                style={{ border: `1px dashed ${color}18` }}
              >
                <div className="w-2 h-2 rounded-full opacity-20" style={{ backgroundColor: color }} />
                <span className="text-xs text-[#2e2e2e]">Drop here</span>
              </div>
            ) : (
              items.map((item) => <ContentCard key={item.id} item={item} />)
            )}
          </SortableContext>

          {items.length > 0 && (
            <button
              onClick={() => onAddContent(id)}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[#333] hover:text-[#666] hover:bg-[#181818] transition-colors text-xs font-medium border border-dashed border-[#1c1c1c] hover:border-[#2c2c2c]"
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
