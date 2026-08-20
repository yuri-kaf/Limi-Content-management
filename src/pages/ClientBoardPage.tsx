import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { LayoutGrid, CalendarDays, Lightbulb, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClients, useShareActions, useShareReconciler } from '../store';
import { ClientReview, ContentItem, ContentStatus, Idea } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import AddContentModal from '../components/AddContentModal';
import ContentDetailModal from '../components/ContentDetailModal';
import ContentCard from '../components/ContentCard';
import ContentCalendar from '../components/ContentCalendar';
import IdeasView from '../components/IdeasView';
import StagePill from '../components/StagePill';
import StageTabs from '../components/StageTabs';
import BoardFilters from '../components/BoardFilters';
import { useIsDesktop } from '../hooks/useMediaQuery';
import { runWrite, STAGES } from '../utils';
import { ContentFilters, NO_FILTERS, activeFilterCount, filterContent } from '../filters';
import {
  boardScroller, boardRow, boardColumn, boardSingle, columnHeader, columnBody,
  columnBodyPlain, countChip, pageToolbar, segmented, segItem, faintText,
  btnPrimary, shell,
} from '../ui';

// `tab` is the short form for the phone tab strip, where four labels share the
// width. The long label is what the column header shows.
interface StageDef {
  id: ContentStatus;
  label: string;
  tab: string;
}

const TEAM_STAGES: StageDef[] = STAGES.map((s) => ({ id: s.id, label: s.label, tab: s.label }));

// Clients see three stages — 'editing' is internal — and the labels are written
// from their point of view rather than the team's.
const CLIENT_STAGES: StageDef[] = [
  { id: 'review', label: 'Needs your review', tab: 'Your review' },
  { id: 'to-post', label: 'Ready to post', tab: 'Ready' },
  { id: 'posted', label: 'Posted', tab: 'Posted' },
];

const CLIENT_PURPOSE: Record<string, string> = {
  review: 'Nothing is waiting on you right now.',
  'to-post': 'Nothing approved and waiting to go out.',
  posted: 'Nothing has been published yet.',
};

// A client's board is read-only, so it needs no droppable and no sortable —
// same column shell, none of the drag machinery.
function ReadOnlyColumn({
  status,
  label,
  items,
  onCardClick,
  filtered = false,
  layout = 'column',
}: {
  status: ContentStatus;
  label: string;
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
  filtered?: boolean;
  layout?: 'column' | 'single';
}) {
  const single = layout === 'single';
  return (
    <div className={single ? 'flex-1 min-h-0 flex flex-col' : boardColumn}>
      {!single && (
        <div className={columnHeader}>
          <StagePill status={status} />
          <span className={`text-[12px] font-medium truncate ${faintText}`}>{label}</span>
          <span className={`${countChip} ml-auto`}>{items.length}</span>
        </div>
      )}
      <div className={single ? columnBodyPlain : columnBody}>
        {items.length === 0 ? (
          <div className="flex-1 flex items-start justify-center pt-8 px-4">
            <p className={`text-[12px] leading-relaxed text-center max-w-[26ch] ${faintText}`}>
              {filtered
                ? 'Nothing here matches the current filter.'
                : CLIENT_PURPOSE[status] ?? 'Nothing here right now.'}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <ContentCard key={item.id} item={item} onCardClick={() => onCardClick(item)} />
          ))
        )}
      </div>
    </div>
  );
}

export default function ClientBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser } = useAuth();
  const {
    clients, loading, addContent, updateContent, deleteContent,
    updateContentStatus, updateClientReview, addComment,
  } = useClients();

  const isAdmin = currentUser?.role === 'admin';
  const isSMM = currentUser?.role === 'social-media-manager';
  const isClientRole = currentUser?.role === 'client';
  const canAdd = isAdmin || isSMM;
  // Must match the condition that renders the draggable board. Gating the
  // handlers more narrowly than the UI is how drag came to look simply dead.
  const canMove = !isClientRole;

  const client = clients.find((c) => c.id === id);

  // Above the early returns: hooks cannot be conditional, and `client` is
  // undefined on the first render while the list loads.
  const { createShare } = useShareActions(client?.id, client?.name ?? '');
  useShareReconciler(client?.id, !isClientRole);

  const [addingToColumn, setAddingToColumn] = useState<ContentStatus | null>(null);
  const [calendarAddDate, setCalendarAddDate] = useState<Date | null>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [view, setView] = useState<'kanban' | 'calendar' | 'ideas'>('kanban');
  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
  const [filters, setFilters] = useState<ContentFilters>(NO_FILTERS);
  const [activeStage, setActiveStage] = useState<ContentStatus>(
    isClientRole ? 'review' : 'editing'
  );
  // Captured once per render so a filtered view cannot shift mid-interaction.
  const now = Date.now();
  const isFiltered = activeFilterCount(filters) > 0;

  // Below lg the board is a tab strip over one full-width column. Chosen in JS
  // rather than CSS because the two layouts cannot both be mounted: each
  // registers the same droppable and sortable ids.
  const isDesktop = useIsDesktop();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Without this the board is unusable without a pointer.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ?item=<id> opens that item's sheet. This is what lets Today and the command
  // palette link to a specific piece of content instead of dropping you on the
  // board to hunt for it.
  const deepLinkedId = searchParams.get('item');
  useEffect(() => {
    if (deepLinkedId) setSelectedId(deepLinkedId);
  }, [deepLinkedId]);

  function closeDetail() {
    setSelectedId(null);
    if (searchParams.has('item')) {
      const next = new URLSearchParams(searchParams);
      next.delete('item');
      setSearchParams(next, { replace: true });
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className={`mb-4 text-sm ${faintText}`}>Client not found.</p>
          <button onClick={() => navigate('/')} className="text-sm text-brand hover:text-brand-hover">
            ← Back to clients
          </button>
        </div>
      </div>
    );
  }

  if (isClientRole && !currentUser?.assignedClientIds?.includes(client.id)) {
    navigate('/');
    return null;
  }

  function canEditItem(item: ContentItem): boolean {
    if (isAdmin) return true;
    if (isSMM) return item.uploadedByEmail === currentUser?.email;
    return false;
  }

  function canDeleteItem(item: ContentItem): boolean {
    if (isAdmin) return true;
    if (isSMM) return item.uploadedByEmail === currentUser?.email;
    return false;
  }

  function getItemsByStatus(status: ContentStatus): ContentItem[] {
    const inStage = (client?.content ?? []).filter((item) => item.status === status);
    return filterContent(inStage, filters, now).sort((a, b) => a.createdAt - b.createdAt);
  }

  function handleDragStart(event: DragStartEvent) {
    if (!canMove) return;
    const item = client?.content.find((c) => c.id === event.active.id);
    if (item) setActiveItem(item);
  }

  // The drop target is either a column or one of the cards inside it, since
  // collision detection reports whichever is closest.
  function resolveDropStatus(overId: string): ContentStatus | null {
    const column = TEAM_STAGES.find((col) => col.id === overId);
    if (column) return column.id;
    return client?.content.find((c) => c.id === overId)?.status ?? null;
  }

  // Committing on drag-over used to look like a live move, but each commit
  // reordered the board under the cursor, which fired another drag-over and
  // committed again. The move belongs on drop; the hover highlight comes from
  // useDroppable's own isOver and needs no state write.
  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    if (!canMove) return;
    const { active, over } = event;
    if (!over || !client) return;
    const activeId = active.id as string;
    const target = resolveDropStatus(over.id as string);
    const item = client.content.find((c) => c.id === activeId);
    if (!target || !item || item.status === target) return;
    runWrite(() => updateContentStatus(client.id, activeId, target), 'move the content');
  }

  function handleEditFromDetail() {
    setEditingItem(liveSelectedItem);
    closeDetail();
  }

  function handleDeleteFromDetail() {
    if (liveSelectedItem && client) {
      deleteContent(client.id, liveSelectedItem.id);
      closeDetail();
    }
  }

  function handleReview(review: ClientReview, note?: string) {
    if (liveSelectedItem && client) {
      updateClientReview(client.id, liveSelectedItem.id, review, note);
    }
  }

  const stages = isClientRole ? CLIENT_STAGES : TEAM_STAGES;
  // A stage the current role cannot see — or a filter that emptied it — must not
  // leave the phone board showing nothing with no tab selected.
  const currentStage = stages.some((s) => s.id === activeStage) ? activeStage : stages[0].id;

  const clientVisibleContent = isClientRole
    ? client.content.filter((item) => CLIENT_STAGES.some((c) => c.id === item.status))
    : client.content;

  // Read the item out of the live list rather than trusting a snapshot held in
  // state, so the sheet reflects a stage change or a review decision.
  const liveSelectedItem = selectedId
    ? client.content.find((c) => c.id === selectedId) ?? null
    : null;

  const views = [
    { id: 'kanban' as const, label: 'Board', icon: LayoutGrid },
    { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
    { id: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
  ];

  const tabs = stages.map((s) => ({
    id: s.id,
    label: s.tab,
    count: getItemsByStatus(s.id).length,
  }));

  function boardColumns() {
    if (isClientRole) {
      return stages.map((s) => (
        <ReadOnlyColumn
          key={s.id}
          status={s.id}
          label={s.label}
          items={getItemsByStatus(s.id)}
          onCardClick={(item) => setSelectedId(item.id)}
          filtered={isFiltered}
        />
      ));
    }
    return TEAM_STAGES.map((col) => (
      <KanbanColumn
        key={col.id}
        id={col.id}
        items={getItemsByStatus(col.id)}
        canAdd={canAdd}
        canEditItem={canEditItem}
        canDeleteItem={canDeleteItem}
        onAddContent={(status) => setAddingToColumn(status)}
        onCardClick={(item) => setSelectedId(item.id)}
        onEditCard={(item) => setEditingItem(item)}
        onDeleteCard={(item) => setSelectedId(item.id)}
        filtered={isFiltered}
      />
    ));
  }

  function singleColumn() {
    if (isClientRole) {
      return (
        <ReadOnlyColumn
          status={currentStage}
          label={stages.find((s) => s.id === currentStage)?.label ?? ''}
          items={getItemsByStatus(currentStage)}
          onCardClick={(item) => setSelectedId(item.id)}
          filtered={isFiltered}
          layout="single"
        />
      );
    }
    return (
      <KanbanColumn
        id={currentStage}
        items={getItemsByStatus(currentStage)}
        canAdd={canAdd}
        canEditItem={canEditItem}
        canDeleteItem={canDeleteItem}
        onAddContent={(status) => setAddingToColumn(status)}
        onCardClick={(item) => setSelectedId(item.id)}
        onEditCard={(item) => setEditingItem(item)}
        onDeleteCard={(item) => setSelectedId(item.id)}
        filtered={isFiltered}
        layout="single"
      />
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* One toolbar row. The old page spent two stacked headers and a stats
          strip on things the sidebar and the column counts already say. */}
      <div className={pageToolbar}>
        {/* The client name is already in the breadcrumb above, with its logo. */}
        <div className={`${segmented} flex-shrink-0`}>
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={segItem(view === v.id)}
              aria-pressed={view === v.id}
            >
              {/* The icon is the thing that goes on a narrow screen, not the
                  word. An unlabelled icon triplet was unreadable on a phone. */}
              <v.icon size={13} className="hidden sm:block" />
              {v.label}
            </button>
          ))}
        </div>

        {view === 'kanban' && (
          <div className="ml-auto flex items-center gap-1.5">
            <BoardFilters value={filters} onChange={setFilters} />
          </div>
        )}

        {canAdd && view === 'kanban' && (
          <button
            onClick={() => setAddingToColumn(isDesktop ? 'editing' : currentStage)}
            className={`${btnPrimary} h-9 min-h-0 px-3 text-[12px] flex-shrink-0`}
          >
            <Plus size={14} />
            New
          </button>
        )}
      </div>

      {view === 'ideas' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`${shell} py-5`}>
            <IdeasView
              clientId={client.id}
              canTriage={!isClientRole}
              onConvert={(idea) => setConvertingIdea(idea)}
            />
          </div>
        </div>
      ) : view === 'calendar' ? (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={`${shell} py-5`}>
            <ContentCalendar
              content={clientVisibleContent}
              canAdd={canAdd}
              onDayClick={(date) => canAdd && setCalendarAddDate(date)}
              onItemClick={(item) => setSelectedId(item.id)}
            />
          </div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveItem(null)}
        >
          {isDesktop ? (
            <div className={boardScroller}>
              <div className={boardRow}>{boardColumns()}</div>
            </div>
          ) : (
            <>
              <StageTabs tabs={tabs} active={currentStage} onChange={setActiveStage} />
              <div className={boardSingle}>{singleColumn()}</div>
            </>
          )}

          <DragOverlay>
            {activeItem ? <ContentCard item={activeItem} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals */}
      {addingToColumn && (
        <AddContentModal
          defaultStatus={addingToColumn}
          onClose={() => setAddingToColumn(null)}
          onSubmit={(data) => {
            runWrite(
              () => addContent(client.id, { ...data, uploadedByEmail: currentUser?.email ?? '' }),
              'add the content'
            );
            setAddingToColumn(null);
          }}
        />
      )}

      {/* Accepted idea → content card, carrying its title, description and
          first link across so nothing is retyped. */}
      {convertingIdea && (
        <AddContentModal
          defaultStatus="editing"
          defaultTitle={convertingIdea.title}
          defaultCaption={convertingIdea.description}
          defaultLink={convertingIdea.links[0] ?? ''}
          onClose={() => setConvertingIdea(null)}
          onSubmit={(data) => {
            runWrite(
              () => addContent(client.id, { ...data, uploadedByEmail: currentUser?.email ?? '' }),
              'create the content'
            );
            setConvertingIdea(null);
          }}
        />
      )}

      {calendarAddDate && (
        <AddContentModal
          defaultStatus="to-post"
          defaultScheduledAt={calendarAddDate.getTime()}
          onClose={() => setCalendarAddDate(null)}
          onSubmit={(data) => {
            runWrite(
              () => addContent(client.id, { ...data, uploadedByEmail: currentUser?.email ?? '' }),
              'add the content'
            );
            setCalendarAddDate(null);
          }}
        />
      )}

      {editingItem && (
        <AddContentModal
          defaultStatus={editingItem.status}
          existingItem={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={(data) => {
            runWrite(
              () =>
                updateContent(client.id, editingItem.id, {
                  title: data.title,
                  driveLink: data.driveLink,
                  driveFileId: data.driveFileId,
                  mediaType: data.mediaType,
                  caption: data.caption,
                  hashtags: data.hashtags,
                  platforms: data.platforms,
                  notes: data.notes,
                  scheduledAt: data.scheduledAt,
                }),
              'save the content'
            );
            setEditingItem(null);
          }}
        />
      )}

      {liveSelectedItem && (
        <ContentDetailModal
          clientId={client.id}
          onComment={(body, atSeconds) =>
            addComment(client.id, liveSelectedItem.id, body, atSeconds)
          }
          onShare={isClientRole ? undefined : () => createShare(liveSelectedItem)}
          onChangeStatus={
            canMove
              ? (status) =>
                  runWrite(
                    () => updateContentStatus(client.id, liveSelectedItem.id, status),
                    'move the content'
                  )
              : undefined
          }
          item={liveSelectedItem}
          isClientRole={isClientRole}
          canEdit={canEditItem(liveSelectedItem)}
          canDelete={canDeleteItem(liveSelectedItem)}
          onClose={closeDetail}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
          // Approve/decline is offered only while the item sits in Review, so
          // "it's in Review" always means "it's waiting on the client".
          onReview={
            isClientRole && liveSelectedItem.status === 'review' ? handleReview : undefined
          }
        />
      )}
    </div>
  );
}
