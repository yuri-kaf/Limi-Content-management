import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContentItem } from '../types';
import { getDriveThumbnailUrl } from '../utils';
import { Film, GripVertical, ExternalLink, Pencil, Trash2, Calendar } from 'lucide-react';

interface Props {
  item: ContentItem;
  onCardClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ContentCard({ item, onCardClick, onEdit, onDelete }: Props) {
  const [imgError, setImgError] = useState(false);
  const thumbnailUrl = item.driveFileId ? getDriveThumbnailUrl(item.driveFileId) : null;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.25 : 1,
  };

  const hasSchedule = item.scheduledAt && item.scheduledAt > 0;
  const scheduledLabel = hasSchedule
    ? new Date(item.scheduledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-[#161616] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl overflow-hidden transition-colors duration-150 cursor-pointer"
      onClick={onCardClick}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail */}
        <div
          className="relative flex-shrink-0 rounded-lg overflow-hidden bg-[#111]"
          style={{ width: 80, aspectRatio: '16/9' }}
        >
          {thumbnailUrl && !imgError ? (
            <img
              src={thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Film size={14} className="text-[#2a2a2a]" />
            </div>
          )}
          {/* Drag handle overlay — desktop only */}
          <button
            {...attributes}
            {...listeners}
            className="absolute inset-0 hidden sm:flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
            aria-label="Drag"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical size={14} className="text-[#ccc]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-[13px] font-medium text-[#ddd] leading-snug flex-1 min-w-0 line-clamp-2">
              {item.title}
            </p>
            {/* Action buttons: always visible on mobile, hover-only on desktop */}
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="p-1.5 rounded-md text-[#444] hover:text-[#aaa] hover:bg-[#222] active:bg-[#222] transition-colors"
                  aria-label="Edit"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-1.5 rounded-md text-[#444] hover:text-[#dc2626] hover:bg-[#1a0808] active:bg-[#1a0808] transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {item.notes && (
            <p className="text-[11px] text-[#4a4a4a] mt-1 line-clamp-1 leading-relaxed">
              {item.notes}
            </p>
          )}

          <div className="flex items-center gap-2.5 mt-1.5">
            <a
              href={item.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#2e2e2e] hover:text-[#dc2626] transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Open in Drive"
            >
              <ExternalLink size={11} />
            </a>
            {scheduledLabel && (
              <div className="flex items-center gap-1 text-[#3a3a3a]">
                <Calendar size={10} />
                <span className="text-[10px] font-medium">{scheduledLabel}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
