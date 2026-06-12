import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContentItem } from '../types';
import { getDriveThumbnailUrl } from '../utils';
import { Film, GripVertical, ExternalLink } from 'lucide-react';

interface Props {
  item: ContentItem;
}

export default function ContentCard({ item }: Props) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-[#161616] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl overflow-hidden transition-colors duration-150"
    >
      {/* Thumbnail */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-[#111] flex items-center justify-center">
            <Film size={20} className="text-[#2a2a2a]" />
          </div>
        )}

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 p-1 rounded-md bg-black/70 text-[#777] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-label="Drag"
        >
          <GripVertical size={13} />
        </button>
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[13px] font-medium text-[#ddd] leading-snug flex-1 min-w-0 line-clamp-2">
            {item.title}
          </p>
          <a
            href={item.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[#333] hover:text-[#dc2626] transition-colors mt-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open in Drive"
          >
            <ExternalLink size={12} />
          </a>
        </div>

        {item.notes && (
          <p className="text-xs text-[#4a4a4a] mt-1.5 line-clamp-2 leading-relaxed">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  );
}
