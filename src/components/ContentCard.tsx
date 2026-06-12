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

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden hover:border-[#3a3a3a] transition-colors duration-150"
    >
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        {thumbnailUrl && !imgError ? (
          <img
            src={thumbnailUrl}
            alt={item.title}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full bg-[#141414] flex items-center justify-center">
            <Film size={24} className="text-[#444]" />
          </div>
        )}

        <button
          {...attributes}
          {...listeners}
          className="absolute top-2 left-2 p-1 rounded-md bg-black/60 text-[#888] opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          aria-label="Drag handle"
        >
          <GripVertical size={14} />
        </button>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-white leading-snug flex-1 min-w-0 line-clamp-2">
            {item.title}
          </p>
          <a
            href={item.driveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[#555] hover:text-[#6366f1] transition-colors mt-0.5"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open in Drive"
          >
            <ExternalLink size={13} />
          </a>
        </div>

        {item.notes && (
          <p className="text-xs text-[#666] mt-1.5 line-clamp-2 leading-relaxed">
            {item.notes}
          </p>
        )}
      </div>
    </div>
  );
}
