import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import BoardFilters from '../components/BoardFilters';
import { runWrite, STAGES } from '../utils';
import { ContentFilters, NO_FILTERS, filterContent } from '../filters';
import {
  boardScroller, boardRow, boardColumn, columnHeader, columnBody, pageToolbar,
  pillGroup, pill, faintText, btnPrimary, shell,
} from '../ui';

const COLUMNS = STAGES;

// Clients see three stages — 'editing' is internal — and the labels are written
// from their point of view rather than the team's.
const CLIENT_STAGES: { id: ContentStatus; label: string }[] = [
  { id: 'review', label: 'Needs your review' },
  { id: 'to-post', label: 'Ready to post' },
  { id: 'posted', label: 'Posted' },
];

// A client's board is read-only, so it needs no droppable and no sortable —
// same column shell, none of the drag machinery.
function ReadOnlyColumn({
  status,
  label,
  items,
  onCardClick,
}: {
  status: ContentStatus;
  label: string;
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
}) {
  return (
    <div className={boardColumn}>
      <div className={columnHeader}>
        <StagePill status={status} />
        <span className={`text-[11px] font-medium ${faintText}`}>{label}</span>
        <span className={`text-[11px] font-semibold tabular-nums ml-auto ${faintText}`}>
          {items.length}
        </span>
      </div>
      <div className={columnBody}>
        {items.length === 0 ? (
          <div className="flex-1 flex items-start justify-center pt-8 px-3">
            <p className={`text-[11px] leading-relaxed text-center ${faintText}`}>
              Nothing here right now.
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
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [view, setView] = useState<'kanban' | 'calendar' | 'ideas'>('kanban');
  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
  const [filters, setFilters] = useState<ContentFilters>(NO_FILTERS);
  // Captured once per render so a filtered view cannot shift mid-interaction.
  const now = Date.now();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    // Without this the board is unusable without a pointer.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
    const column = COLUMNS.find((col) => col.id === overId);
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
    setEditingItem(selectedItem);
    setSelectedItem(null);
  }

  function handleDeleteFromDetail() {
    if (selectedItem && client) {
      deleteContent(client.id, selectedItem.id);
      setSelectedItem(null);
    }
  }

  function handleReview(review: ClientReview, note?: string) {
    if (selectedItem && client) {
      updateClientReview(client.id, selectedItem.id, review, note);
    }
  }

  const clientVisibleContent = isClientRole
    ? client.content.filter((item) => CLIENT_STAGES.some((c) => c.id === item.status))
    : client.content;

  // Read the item back out of the live list rather than trusting the snapshot
  // held in state, so the sheet reflects a stage change or a review decision.
  const liveSelectedItem = selectedItem
    ? client.content.find((c) => c.id === selectedItem.id) ?? null
    : null;

  const views = [
    { id: 'kanban' as const, label: 'Board', icon: LayoutGrid },
    { id: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
    { id: 'ideas' as const, label: 'Ideas', icon: Lightbulb },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* One toolbar row. The old page spent two stacked headers and a stats
          strip on things the sidebar and the column counts already say. */}
      <div className={pageToolbar}>
        {/* The client name is already in the breadcrumb above, and its avatar
            is in the sidebar. Repeating both here just cost the board space. */}
        <div className={`${pillGroup} flex-shrink-0`}>
          {views.map((v) => (
            <button key={v.id} onClick={() => setView(v.id)} className={pill(view === v.id)}>
              <v.icon size={12} />
              <span className="hidden sm:inline">{v.label}</span>
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
            onClick={() => setAddingToColumn('editing')}
            className={`${btnPrimary} h-8 min-h-0 px-3 flex-shrink-0`}
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Add</span>
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
              onItemClick={(item) => setSelectedItem(item)}
            />
          </div>
        </div>
      ) : isClientRole ? (
        // One horizontal row at every width. A 300px column on a 375px screen
        // leaves the next one peeking, which advertises the scroll better than
        // a row of stage tabs did — and it is one implementation, not two.
        <div className={boardScroller}>
          <div className={boardRow}>
            {CLIENT_STAGES.map((c) => (
              <ReadOnlyColumn
                key={c.id}
                status={c.id}
                label={c.label}
                items={getItemsByStatus(c.id)}
                onCardClick={(item) => setSelectedItem(item)}
              />
            ))}
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
          <div className={boardScroller}>
            <div className={boardRow}>
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  id={col.id}
                  label={col.label}
                  color={col.color}
                  items={getItemsByStatus(col.id)}
                  canAdd={canAdd}
                  canEditItem={canEditItem}
                  canDeleteItem={canDeleteItem}
                  onAddContent={(status) => setAddingToColumn(status)}
                  onCardClick={(item) => setSelectedItem(item)}
                  onEditCard={(item) => setEditingItem(item)}
                  onDeleteCard={(item) => setSelectedItem(item)}
                />
              ))}
            </div>
          </div>

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
          onClose={() => setSelectedItem(null)}
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
