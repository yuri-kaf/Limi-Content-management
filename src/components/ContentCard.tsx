import { useCallback, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Campaign, ContentItem, ContentStatus } from '../types';
import { getMediaInfo, mediaTypeOf, captionOf, PLATFORM_LABELS } from '../utils';
import { stageCardFill, stageCardText, stageCardVars } from '../stageColors';
import { lift } from '../ui';
import ColorLabel from './ColorLabel';
import {
  Film, GripVertical, ExternalLink, Pencil, Trash2, Calendar, AlertCircle,
  Image as ImageIcon, Download,
} from 'lucide-react';

interface Props {
  item: ContentItem;
  /** The campaign it belongs to, shown as a coloured label. */
  campaign?: Pick<Campaign, 'name' | 'color'>;
  onCardClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /**
   * False where a card cannot move: on a client's read-only board, and on the
   * phone board, which mounts one column and so has nowhere to drop it. Such a
   * card never registers with dnd-kit, so no key or press can lift it, and
   * Enter or Space opens it as they would any button.
   */
  draggable?: boolean;
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

// On the pastel fill a hover wash has to be lighter than the card, not darker.
const iconBtn =
  'w-[26px] h-[26px] inline-flex items-center justify-center rounded-tile text-ink-soft dark:text-ink-softdark hover:text-ink dark:hover:text-ink-dark hover:bg-white/60 dark:hover:bg-black/20 transition-colors';

// Chips sit one layer above the fill: translucent white in light, a darker wash
// in dark. Their stage-coloured text clears AA on the fill itself, and the
// wash only lightens (or, in dark, deepens) what it sits on.
const chip = `bg-white/70 dark:bg-black/20 ${stageCardText}`;

// The client's decision and an overdue date use colours measured against white,
// so their chips are solid rather than translucent.
const solidChip = 'bg-white dark:bg-black/30';

// The copy in the hand: tilted and raised, as if picked up. While a drop
// settles, ContentBoard's drop animation puts `settling` on the overlay, and
// the card straightens as it lands instead of snapping flat at the end.
const inHand =
  'shadow-drag rotate-[1.5deg] scale-[1.02] transition-[transform,box-shadow] duration-200 ease-out-soft [.settling_&]:rotate-0 [.settling_&]:scale-100 [.settling_&]:shadow-lift';

// The box both shells draw, filled with the card's stage pastel (its colours
// ride along as custom properties, see stageColors.ts). flex-shrink-0 is not
// cosmetic: the column body is a capped-height flex column, and flexbox
// shrinks its children to fit before it will scroll — which clipped every
// card's second title line. The focus ring is solid brand, 4.8:1 on the light
// page and 3.6:1 on the dark one: at 40% it was 1.9:1 and 1.5:1, and less
// against the fills, under the 3:1 a focus indicator needs.
const cardBox = `group relative overflow-hidden flex-shrink-0 rounded-card ${stageCardFill} focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`;

interface ShellProps {
  /** The card's stage, which picks the pastel it is filled with. */
  status: ContentStatus;
  onOpen?: () => void;
  children: React.ReactNode;
}

// The box around a card that can be dragged, and everything about the drag.
function SortableShell({
  id, status, isOverlay, onOpen, children,
}: ShellProps & { id: string; isOverlay?: boolean }) {
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  const {
    attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging,
  } = useSortable({
    id,
    disabled: isOverlay,
  });

  // The card is both what moves and what a key lifts. Naming it the activator
  // is what leaves keys pressed on the links and buttons inside it to them:
  // without one, dnd-kit lifted the card on a key pressed anywhere within it
  // and swallowed the key, so Enter on Edit started a drag and never edited.
  const setCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef]
  );

  // dnd-kit types its listeners as bare Functions.
  const sensorListeners = listeners as Record<string, ((ev: unknown) => void) | undefined> | undefined;

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
          sensorListeners?.onPointerDown?.(e);
        },
        // Enter opens the card and Space lifts it. dnd-kit lifts on either by
        // default, which left a keyboard user no way to open a card at all,
        // though cards are opened far more often than moved. So Enter does
        // what it does on any button and is kept from the sensor, and Space,
        // the key the board's screen reader instructions name, lifts. While
        // the card is being carried, Enter is the sensor's, to drop it with.
        onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' && e.target === e.currentTarget && !isDragging) {
            onOpen?.();
            return;
          }
          sensorListeners?.onKeyDown?.(e);
        },
      };

  // The cursor is an inline style because a grab cursor has to win over any
  // class, and dnd-kit's transform has to be inline anyway.
  //
  // dnd-kit's transition is kept only while it has a transform to animate.
  // useSortable answers every new items array with an instant transition, and
  // KanbanColumn passes a new one on every render, so a card at rest carried
  // `transform 0ms linear` inline, which beat the lift's easing and made the
  // hover rise snap.
  const style = isOverlay
    ? { ...stageCardVars(status), cursor: 'grabbing' as const }
    : {
        ...stageCardVars(status),
        transform: CSS.Transform.toString(transform),
        transition: transform ? transition : undefined,
        opacity: isDragging ? 0.25 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
        // Recommended for dnd-kit's delay-based TouchSensor: keeps the page
        // scrollable and pinch-zoomable while suppressing double-tap zoom.
        touchAction: 'manipulation' as const,
      };

  function handleClick(e: React.MouseEvent) {
    const start = pressedAt.current;
    pressedAt.current = null;
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP) return;
    onOpen?.();
  }

  // The drag copy is tilted and raised, as if picked up; the card left behind
  // on the board lifts on hover instead.
  return (
    <div
      ref={setCardRef}
      style={style}
      data-stage={status}
      className={`${cardBox} ${isOverlay ? inHand : lift}`}
      onClick={handleClick}
      {...dragProps}
    >
      {children}
    </div>
  );
}

// The box around a card that cannot move: a button in all but tag, since a
// <button> may not hold the links inside the card. A click opens it like any
// card on the board, so it lifts like one, under a pointer rather than a grab.
function StaticShell({ status, onOpen, children }: ShellProps) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // A key pressed on one of the card's own links belongs to that link.
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      // Space would otherwise scroll the column.
      e.preventDefault();
      onOpen?.();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      style={stageCardVars(status)}
      data-stage={status}
      className={`${cardBox} ${lift} cursor-pointer`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export default function ContentCard({
  item, campaign, onCardClick, onEdit, onDelete, draggable = true, isOverlay,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const media = getMediaInfo(item.driveLink);
  const thumbnailUrl = media.previewUrl;
  const hasPreview = !!thumbnailUrl && !imgError;
  const isGraphic = mediaTypeOf(item) === 'graphic';
  const caption = captionOf(item);
  const platforms = item.platforms ?? [];

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
      ? { text: 'Declined', className: 'text-brand-text dark:text-brand-textdark' }
      : item.clientReview === 'approved'
        ? { text: 'Approved', className: 'text-emerald-700 dark:text-emerald-400' }
        : null;

  const face = (
    <div className="flex items-start gap-2.5 p-2.5">
      {/* An image earns the 16:9 frame; the absence of one does not. Without
          a preview this collapses to a type marker the size of a favicon. */}
      {hasPreview ? (
        <div
          className="relative flex-shrink-0 rounded-tile overflow-hidden bg-white/50 dark:bg-black/20"
          style={{ width: 64, aspectRatio: '16/9' }}
        >
          <img
            src={thumbnailUrl!}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setImgError(true)}
          />
          {/* The grip is a hint, not the hit area — hence pointer-events-none. */}
          {draggable && !isOverlay && (
            <div
              className="absolute inset-0 hidden lg:flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              aria-hidden="true"
            >
              <GripVertical size={13} className="text-white/80" />
            </div>
          )}
        </div>
      ) : (
        <span
          className={`flex-shrink-0 w-7 h-7 rounded-tile inline-flex items-center justify-center ${chip}`}
          title={isGraphic ? 'Graphic' : 'Video'}
        >
          {isGraphic ? <ImageIcon size={14} /> : <Film size={14} />}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <p className="text-[13px] font-medium text-ink dark:text-ink-dark leading-snug flex-1 min-w-0 line-clamp-2">
            {item.title}
          </p>
          {/* Pointer-only, revealed on hover. On a phone the card itself is
              the target and the detail sheet carries the same four actions
              at a size a thumb can hit. On the drag copy the row keeps its
              width, so the title wraps as it does on the card, but a hover
              over the copy reveals nothing. */}
          <div
            className={`hidden lg:flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex-shrink-0 ${
              isOverlay ? 'invisible' : ''
            }`}
          >
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
              <ExternalLink size={13} />
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
                <Download size={13} />
              </a>
            )}
            {onEdit && (
              <button
                onPointerDown={stopDrag}
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className={iconBtn}
                aria-label="Edit"
              >
                <Pencil size={13} />
              </button>
            )}
            {/* brand-textdark, not the brand red: on the dark fills, under the
                button's hover wash, the brand red is only about 3.1:1. */}
            {onDelete && (
              <button
                onPointerDown={stopDrag}
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className={`${iconBtn} hover:!text-brand-text dark:hover:!text-brand-textdark`}
                aria-label="Delete"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* ink-soft, not ink-faint: faint falls below 4.5:1 on every fill, in both themes. */}
        {caption && (
          <p className="text-[11px] mt-0.5 line-clamp-1 leading-relaxed text-ink-soft dark:text-ink-softdark">
            {caption}
          </p>
        )}

        {/* The campaign, then signals ordered by how much each should change
            your plans: the client's decision, then the schedule, then where
            it is going. */}
        {(campaign || reviewBadge || scheduledLabel || platforms.length > 0) && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {/* Capped at 96px: in a 280px column beside a thumbnail, anything
                wider pushes an "Approved" badge onto a second line. The full
                name is on hover. The hairline ring is for a campaign in its
                card's own hue, purple on the Editing fill say, which would
                otherwise disappear into it. */}
            {campaign && (
              <ColorLabel
                color={campaign.color}
                className="max-w-[96px] ring-1 ring-black/5 dark:ring-white/10"
                title={campaign.name}
              >
                {campaign.name}
              </ColorLabel>
            )}
            {reviewBadge && (
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-[4px] ${solidChip} ${reviewBadge.className}`}
              >
                {reviewBadge.text}
              </span>
            )}
            {scheduledLabel && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-[4px] ${
                  overdue ? `${solidChip} text-brand-text dark:text-brand-textdark` : chip
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
                className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px] ${chip}`}
              >
                {PLATFORM_LABELS[p]}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Registering a card with useSortable is what lets the keyboard sensor lift
  // it, and a hook cannot be skipped conditionally, so a card that must stay
  // put gets a shell that never calls it.
  return draggable ? (
    <SortableShell id={item.id} status={item.status} isOverlay={isOverlay} onOpen={onCardClick}>
      {face}
    </SortableShell>
  ) : (
    <StaticShell status={item.status} onOpen={onCardClick}>{face}</StaticShell>
  );
}
