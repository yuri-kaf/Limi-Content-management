import { useCallback, useRef, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Campaign, ContentItem, ContentStatus } from '../types';
import { getMediaInfo, openLabel, mediaTypeOf, captionOf, PLATFORM_LABELS } from '../utils';
import { stageCardVars, stageDot } from '../stageColors';
import { STAGES } from '../utils';
import { lift, focusRingInset } from '../ui';
import Menu, { MenuEntry } from './m3/Menu';
import { isLate } from '../today';
import ColorLabel from './ColorLabel';
import {
  Film, ExternalLink, Pencil, Trash2, AlertCircle,
  Image as ImageIcon, Download, MoreVertical, ChevronDown,
} from '../icons';

interface Props {
  item: ContentItem;
  /** The campaign it belongs to, shown as a coloured label. */
  campaign?: Pick<Campaign, 'name' | 'color'>;
  onCardClick?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Moves the card to another stage from its menu: one tap, no drag. */
  onMove?: (status: ContentStatus) => void;
  /**
   * Where the card sits. 'lane' is a board column's grey lane, so the card is
   * white; 'page' is the white page of a single-stage grid, so it is filled.
   */
  surface?: 'lane' | 'page';
  /** Show the stage as a chip with its move menu (the grid, where no column names it). */
  showStage?: boolean;
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


// The copy in the hand: tilted and raised, as if picked up. While a drop
// settles, ContentBoard's drop animation puts `settling` on the overlay, and
// the card straightens as it lands instead of snapping flat at the end.
const inHand =
  'shadow-drag rotate-[1.5deg] scale-[1.02] transition-[transform,box-shadow] duration-200 ease-out-soft [.settling_&]:rotate-0 [.settling_&]:scale-100 [.settling_&]:shadow-lift';

// The box both shells draw. White on a board lane, filled on the white page;
// no outline either way. flex-shrink-0 is not cosmetic: the column body is a
// capped-height flex column, and flexbox shrinks its children to fit before it
// will scroll, which clipped every card's last title line.
const cardBox = (surface: 'lane' | 'page') =>
  `group relative flex-shrink-0 rounded-card ${
    surface === 'lane'
      ? 'bg-canvas dark:bg-hover-dark shadow-rest dark:shadow-none'
      : 'bg-raised dark:bg-raised-dark [@media(hover:hover)]:hover:bg-hover/70 dark:[@media(hover:hover)]:hover:bg-hover-dark'
  } ${focusRingInset}`;

interface ShellProps {
  status: ContentStatus;
  surface: 'lane' | 'page';
  onOpen?: () => void;
  children: React.ReactNode;
}

// The box around a card that can be dragged, and everything about the drag.
function SortableShell({
  id, status, surface, isOverlay, onOpen, children,
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
      className={`${cardBox(surface)} ${isOverlay ? inHand : lift}`}
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
function StaticShell({ status, surface, onOpen, children }: ShellProps) {
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
      className={`${cardBox(surface)} ${lift} cursor-pointer`}
      onClick={onOpen}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

export default function ContentCard({
  item, campaign, onCardClick, onEdit, onDelete, onMove, surface = 'lane', showStage = false,
  draggable = true, isOverlay,
}: Props) {
  const [imgError, setImgError] = useState(false);
  const media = getMediaInfo(item.driveLink);
  const thumbnailUrl = media.previewUrl;
  // OneDrive, the team's usual store, never gives a preview without a signed-in
  // Microsoft user, so most cards have none. A card is text first and shows a
  // picture only where the link can give one (Drive, YouTube, Dropbox, images).
  const hasPreview = !!thumbnailUrl && !imgError;
  const isGraphic = mediaTypeOf(item) === 'graphic';
  const caption = captionOf(item);
  const platforms = item.platforms ?? [];
  const stage = STAGES.find((s) => s.id === item.status);

  const hasSchedule = !!item.scheduledAt && item.scheduledAt > 0;
  const scheduledLabel = hasSchedule
    ? new Date(item.scheduledAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  // A post whose slot has passed and which never went out is the one thing on
  // this board that is actually wrong, so it is the one thing allowed to shout.
  const overdue = isLate(item, Date.now());

  // Pending renders as absence: it is the normal state.
  const reviewBadge =
    item.clientReview === 'declined'
      ? { text: 'Changes asked', className: 'bg-brand-soft dark:bg-brand-softdark text-brand-on dark:text-brand-ondark' }
      : item.clientReview === 'approved'
        ? { text: 'Approved', className: 'bg-success-soft dark:bg-success-softdark text-success-text dark:text-success-textdark' }
        : null;

  const moveItems: MenuEntry[] = onMove
    ? STAGES.filter((s) => s.id !== item.status).map((s) => ({
        key: `move-${s.id}`,
        label: `Move to ${s.label}`,
        icon: <span className={`w-2 h-2 rounded-full ${stageDot}`} style={stageCardVars(s.id)} />,
        onSelect: () => onMove(s.id),
      }))
    : [];
  const actionItems: MenuEntry[] = [
    ...(item.driveLink
      ? [{ key: 'open', label: openLabel(media), icon: <ExternalLink size={18} />, onSelect: () => window.open(item.driveLink, '_blank', 'noopener') }]
      : []),
    ...(isGraphic && media.downloadUrl
      ? [{ key: 'dl', label: 'Download image', icon: <Download size={18} />, onSelect: () => window.open(media.downloadUrl!, '_blank', 'noopener') }]
      : []),
    ...(onEdit ? [{ key: 'edit', label: 'Edit', icon: <Pencil size={18} />, onSelect: onEdit }] : []),
    ...(onDelete ? [{ key: 'del', label: 'Delete', icon: <Trash2 size={18} />, danger: true, onSelect: onDelete }] : []),
  ];
  const menuItems: MenuEntry[] = [
    ...moveItems,
    ...(moveItems.length && actionItems.length ? (['divider'] as MenuEntry[]) : []),
    ...actionItems,
  ];

  // Pressing a control must never begin a drag, and its click must not bubble
  // up and open the sheet.
  const stopDrag = (e: React.PointerEvent) => e.stopPropagation();
  const stopKeys = (e: React.KeyboardEvent) => e.stopPropagation();

  const face = (
    <div className="flex items-start gap-2.5 p-2.5">
      {hasPreview && (
        <div className="flex-shrink-0 w-9 h-11 rounded-[6px] overflow-hidden bg-hover dark:bg-pressed-dark">
          <img
            src={thumbnailUrl!}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
            onError={() => setImgError(true)}
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          <p className="flex-1 min-w-0 text-[13px] font-medium leading-[18px] text-ink dark:text-ink-dark line-clamp-3 break-words">
            {item.title}
          </p>
          {/* The drag copy keeps the menu's room, so its title wraps as the
              card's does and it lands without a jump. */}
          {menuItems.length > 0 && isOverlay && (
            <span data-menu-slot className="-mr-1 -mt-0.5 w-6 h-6 flex-shrink-0" aria-hidden="true" />
          )}
          {menuItems.length > 0 && !isOverlay && (
            <span data-menu-slot onPointerDown={stopDrag} onKeyDown={stopKeys} className="-mr-1 -mt-0.5 flex-shrink-0">
              <Menu
                label={`${item.title} actions`}
                align="end"
                minWidth={200}
                items={menuItems}
                trigger={(p) => (
                  <button
                    {...p}
                    ref={p.ref}
                    className={`w-6 h-6 [@media(hover:none)]:w-8 [@media(hover:none)]:h-8 rounded-full inline-flex items-center justify-center text-ink-faint dark:text-ink-faintdark hover:text-ink dark:hover:text-ink-dark hover:bg-ink/[.08] dark:hover:bg-ink-dark/[.1] transition-[opacity,color] [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 aria-expanded:opacity-100 ${focusRingInset}`}
                    aria-label={`${item.title} actions`}
                  >
                    <MoreVertical size={18} />
                  </button>
                )}
              />
            </span>
          )}
        </div>

        {surface === 'page' && caption && (
          <p className="mt-0.5 text-[12px] leading-4 line-clamp-2 text-ink-soft dark:text-ink-softdark">{caption}</p>
        )}

        <div className="flex items-center gap-x-1.5 gap-y-1 mt-1 flex-wrap text-[11px] leading-4 text-ink-soft dark:text-ink-softdark">
          {showStage && stage && (
            onMove && !isOverlay ? (
              <span onPointerDown={stopDrag} onKeyDown={stopKeys}>
                <Menu
                  label="Move to stage"
                  minWidth={180}
                  items={STAGES.map((s) => ({
                    key: s.id,
                    label: s.label,
                    icon: <span className={`w-2 h-2 rounded-full ${stageDot}`} style={stageCardVars(s.id)} />,
                    checked: s.id === item.status,
                    onSelect: () => s.id !== item.status && onMove(s.id),
                  }))}
                  trigger={(p) => (
                    <button
                      {...p}
                      ref={p.ref}
                      className={`inline-flex items-center gap-1 h-5 [@media(hover:none)]:h-7 pl-1.5 pr-0.5 rounded-full bg-canvas dark:bg-hover-dark ring-1 ring-ink/10 dark:ring-ink-dark/10 text-ink dark:text-ink-dark font-medium hover:bg-hover dark:hover:bg-pressed-dark ${focusRingInset}`}
                      aria-label={`Stage: ${stage.label}. Change stage`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${stageDot}`} style={stageCardVars(item.status)} />
                      {stage.label}
                      <ChevronDown size={14} />
                    </button>
                  )}
                />
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-ink dark:text-ink-dark">
                <span className={`w-1.5 h-1.5 rounded-full ${stageDot}`} style={stageCardVars(item.status)} />
                {stage.label}
              </span>
            )
          )}
          <span title={isGraphic ? 'Graphic' : 'Video'} className="inline-flex">
            {isGraphic ? <ImageIcon size={14} aria-label="Graphic" /> : <Film size={14} aria-label="Video" />}
          </span>
          {scheduledLabel && (
            <span
              className={`inline-flex items-center gap-0.5 whitespace-nowrap ${
                overdue ? 'text-brand-text dark:text-brand-textdark font-medium' : ''
              }`}
              title={overdue ? 'This slot was on an earlier day and it has not been posted' : undefined}
            >
              {overdue && <AlertCircle size={13} />}
              {scheduledLabel}
            </span>
          )}
          {reviewBadge && (
            <span className={`inline-flex items-center h-[18px] px-1.5 rounded-chip font-medium whitespace-nowrap ${reviewBadge.className}`}>
              {reviewBadge.text}
            </span>
          )}
          {campaign && (
            <ColorLabel color={campaign.color} className="max-w-[110px]" title={campaign.name}>
              {campaign.name}
            </ColorLabel>
          )}
          {platforms.length > 0 && (
            <span className="whitespace-nowrap" title={platforms.map((p) => PLATFORM_LABELS[p]).join(', ')}>
              {platforms.map((p) => PLATFORM_SHORT[p]).join(' · ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Registering a card with useSortable is what lets the keyboard sensor lift
  // it, and a hook cannot be skipped conditionally, so a card that must stay
  // put gets a shell that never calls it.
  return draggable ? (
    <SortableShell id={item.id} status={item.status} surface={surface} isOverlay={isOverlay} onOpen={onCardClick}>
      {face}
    </SortableShell>
  ) : (
    <StaticShell status={item.status} surface={surface} onOpen={onCardClick}>{face}</StaticShell>
  );
}

const PLATFORM_SHORT: Record<string, string> = { instagram: 'IG', facebook: 'FB', tiktok: 'TT' };
