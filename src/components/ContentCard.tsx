import { useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ContentItem } from '../types';
import { getMediaInfo, mediaTypeOf, captionOf, PLATFORM_LABELS } from '../utils';
import { cardInteractive, faintText } from '../ui';
import {
  Film, GripVertical, ExternalLink, Pencil, Trash2, Calendar, AlertCircle,
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

const iconBtn =
  'p-1 rounded-tile text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-hover dark:hover:bg-hover-dark transition-colors';

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

  const hasSchedule = !!item.scheduledAt && item.scheduledAt > 0;
  const scheduledLabel = hasSchedule
    ? new Date(item.scheduledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  // A post whose slot has passed and which never went out is the one thing on
  // this board that is actually wrong, so it is the one thing allowed to shout.
  const overdue = hasSchedule && item.scheduledAt! < Date.now() && item.status !== 'posted';

  // The client's decision used to be visible only inside the detail sheet,
  // which meant scanning a Review column told you nothing about what was
  // actually waiting on you. Pending renders as absence: it is the normal state,
  // and a badge on every card would carry no information.
  const reviewBadge =
    item.clientReview === 'declined'
      ? { text: 'Declined', className: 'bg-brand-soft dark:bg-brand-softdark text-brand dark:text-red-400' }
      : item.clientReview === 'approved'
        ? { text: 'Approved', className: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' }
        : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group ${cardInteractive} overflow-hidden`}
      onClick={handleClick}
      {...dragProps}
    >
      <div className="flex items-start gap-2.5 p-2.5">
        {/* Thumbnail */}
        <div
          className="relative flex-shrink-0 rounded-tile overflow-hidden bg-tint dark:bg-tint-dark"
          style={{ width: 68, aspectRatio: '16/9' }}
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
                <ImageIcon size={13} className={faintText} />
              ) : (
                <Film size={13} className={faintText} />
              )}
            </div>
          )}
          {/* The grip is a hint, not the hit area — hence pointer-events-none. */}
          {!isOverlay && (
            <div
              className="absolute inset-0 hidden sm:flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              aria-hidden="true"
            >
              <GripVertical size={13} className="text-white/80" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="text-[13px] font-medium text-ink dark:text-ink-dark leading-snug flex-1 min-w-0 line-clamp-2">
              {item.title}
            </p>
            {/* Always visible on touch, hover-only on a pointer. */}
            <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
              <a
                href={item.driveLink}
                target="_blank"
                rel="noopener noreferrer"
                draggable={false}
                className={iconBtn}
                onPointerDown={stopDrag}
                onClick={(e) => e.stopPropagation()}
                aria-label={`Open in ${media.label}`}
              >
                <ExternalLink size={12} />
              </a>
              {isGraphic && media.downloadUrl && (
                <a
                  href={media.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  draggable={false}
                  className={iconBtn}
                  onPointerDown={stopDrag}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Download image"
                >
                  <Download size={12} />
                </a>
              )}
              {onEdit && (
                <button
                  onPointerDown={stopDrag}
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className={iconBtn}
                  aria-label="Edit"
                >
                  <Pencil size={12} />
                </button>
              )}
              {onDelete && (
                <button
                  onPointerDown={stopDrag}
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className={`${iconBtn} hover:!text-brand hover:!bg-brand-soft dark:hover:!bg-brand-softdark`}
                  aria-label="Delete"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </div>

          {caption && (
            <p className={`text-[11px] mt-0.5 line-clamp-1 leading-relaxed ${faintText}`}>
              {caption}
            </p>
          )}

          {/* Signals, ordered by how much each should change your plans: the
              client's decision, then the schedule, then where it is going. */}
          {(reviewBadge || scheduledLabel || platforms.length > 0) && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {reviewBadge && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${reviewBadge.className}`}>
                  {reviewBadge.text}
                </span>
              )}
              {scheduledLabel && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${
                    overdue
                      ? 'bg-brand-soft dark:bg-brand-softdark text-brand dark:text-red-400'
                      : faintText
                  }`}
                  title={overdue ? 'This slot has passed and it has not been posted' : undefined}
                >
                  {overdue ? <AlertCircle size={10} /> : <Calendar size={10} />}
                  {scheduledLabel}
                </span>
              )}
              {platforms.map((p) => (
                <span
                  key={p}
                  className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-tint dark:bg-tint-dark text-ink-faint dark:text-ink-faintdark"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
