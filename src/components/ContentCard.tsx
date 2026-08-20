import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContentItem } from '../types';
import { getMediaInfo, mediaTypeOf, captionOf, PLATFORM_LABELS } from '../utils';
import { cardInteractive } from '../ui';
import {
  Film, GripVertical, ExternalLink, Pencil, Trash2, Calendar,
  Image as ImageIcon, Download,
} from 'lucide-react';

interface Props {
  item: ContentItem;
  onCardClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * True for the copy rendered inside <DragOverlay>. That copy shares the
   * dragged item's id, so leaving it enabled would register a drop target that
   * follows the cursor and wins every collision test against the real columns.
   */
  isOverlay?: boolean;
}

// Past this many pixels a press is a drag, so the release must not also be
// treated as a click that opens the detail sheet. Deliberately below dnd-kit's
// own 8px activation distance: a press that wandered without ever starting a
// drag should still count as a click.
const CLICK_SLOP = 4;

export default function ContentCard({ item, onCardClick, onEdit, onDelete, isOverlay }: Props) {
  const [imgError, setImgError] = useState(false);
  const media = getMediaInfo(item.driveLink);
  const thumbnailUrl = media.previewUrl;
  const isGraphic = mediaTypeOf(item) === 'graphic';
  const caption = captionOf(item);
  const platforms = item.platforms ?? [];
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled: isOverlay,
  });

  // The whole card is the drag surface. It used to be a hover-revealed 80x45
  // button over the thumbnail, so most attempts to drag a card grabbed dead
  // space and opened the detail sheet instead.
  const dragProps = isOverlay
    ? {}
    : {
        ...attributes,
        ...listeners,
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          pressedAt.current = { x: e.clientX, y: e.clientY };
          (listeners as Record<string, ((ev: unknown) => void) | undefined>)?.onPointerDown?.(e);
        },
      };

  const style = isOverlay
    ? { cursor: 'grabbing' as const }
    : {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        // cursor-grab can't go in the class list: cardInteractive already sets
        // cursor-pointer at equal specificity, so which one won would depend on
        // stylesheet order.
        cursor: isDragging ? 'grabbing' : 'grab',
        // Recommended for dnd-kit's delay-based TouchSensor: keeps the page
        // scrollable and pinch-zoomable while suppressing double-tap zoom.
        touchAction: 'manipulation' as const,
      };

  function handleClick(e: React.MouseEvent) {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP) return;
    onCardClick?.();
  }

  // Pressing a control must never begin a drag, and its click must not bubble
  // up and open the sheet.
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();

  const hasSchedule = item.scheduledAt && item.scheduledAt > 0;
  const scheduledLabel = hasSchedule
    ? new Date(item.scheduledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${cardInteractive} overflow-hidden`}
      onClick={handleClick}
      {...dragProps}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Thumbnail */}
        <div
          className="relative flex-shrink-0 rounded-lg overflow-hidden bg-neutral-100 dark:bg-[#111]"
          style={{ width: 80, aspectRatio: '16/9' }}
        >
          {thumbnailUrl && !imgError ? (
            <img
              src={thumbnailUrl}
              alt={item.title}
              className="w-full h-full object-cover"
              draggable={false}
              onError={() => setImgError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isGraphic ? (
                <ImageIcon size={14} className="text-neutral-300 dark:text-[#2a2a2a]" />
              ) : (
                <Film size={14} className="text-neutral-300 dark:text-[#2a2a2a]" />
              )}
            </div>
          )}
          {/* The grip is a hint now, not the hit area — hence pointer-events-none. */}
          {!isOverlay && (
            <div
              className="absolute inset-0 hidden sm:flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              aria-hidden="true"
            >
              <GripVertical size={14} className="text-[#ccc]" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-[13px] font-medium text-neutral-800 dark:text-[#ddd] leading-snug flex-1 min-w-0 line-clamp-2">
              {item.title}
            </p>
            {/* Action buttons: always visible on mobile, hover-only on desktop */}
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0 ml-1">
              {onEdit && (
                <button
                  onPointerDown={stopDrag}
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="p-1.5 rounded-md text-neutral-400 dark:text-[#444] hover:text-neutral-700 dark:hover:text-[#aaa] hover:bg-neutral-100 dark:hover:bg-[#222] active:bg-neutral-100 dark:active:bg-[#222] transition-colors"
                  aria-label="Edit"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onDelete && (
                <button
                  onPointerDown={stopDrag}
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-1.5 rounded-md text-neutral-400 dark:text-[#444] hover:text-[#dc2626] hover:bg-red-50 dark:hover:bg-[#1a0808] active:bg-red-50 dark:active:bg-[#1a0808] transition-colors"
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {caption && (
            <p className="text-[11px] text-neutral-400 dark:text-[#4a4a4a] mt-1 line-clamp-1 leading-relaxed">
              {caption}
            </p>
          )}

          {platforms.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {platforms.map((p) => (
                <span
                  key={p}
                  className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-500 dark:text-[#666]"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2.5 mt-1.5">
            <a
              href={item.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="text-neutral-300 dark:text-[#2e2e2e] hover:text-[#dc2626] transition-colors"
              onPointerDown={stopDrag}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Open in ${media.label}`}
            >
              <ExternalLink size={11} />
            </a>
            {isGraphic && media.downloadUrl && (
              <a
                href={media.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                className="flex items-center gap-1 text-[10px] font-medium text-neutral-400 dark:text-[#3a3a3a] hover:text-[#dc2626] transition-colors"
                onPointerDown={stopDrag}
                onClick={(e) => e.stopPropagation()}
                aria-label="Download image"
              >
                <Download size={11} />
                Download
              </a>
            )}
            {scheduledLabel && (
              <div className="flex items-center gap-1 text-neutral-400 dark:text-[#3a3a3a]">
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
