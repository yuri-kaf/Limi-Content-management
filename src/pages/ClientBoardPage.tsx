import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import { ArrowLeft, User, LayoutGrid, CalendarDays, Lightbulb, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useClients, useShareActions, useShareReconciler } from '../store';
import { ClientReview, ContentItem, ContentStatus } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import AddContentModal from '../components/AddContentModal';
import ContentDetailModal from '../components/ContentDetailModal';
import ContentCard from '../components/ContentCard';
import ContentCalendar from '../components/ContentCalendar';
import IdeasView from '../components/IdeasView';
import { Idea } from '../types';
import { runWrite, STAGES } from '../utils';
import { page, tile } from '../ui';

const COLUMNS = STAGES;

// Clients see a three-stage view: 'editing' is internal and stays hidden, and
// the labels are written from their point of view rather than the team's.
const CLIENT_COLUMNS: { id: ContentStatus; label: string; color: string }[] = [
  { id: 'review', label: 'Needs Your Review', color: '#0284c7' },
  { id: 'to-post', label: 'Ready to Post', color: '#d97706' },
  { id: 'posted', label: 'Posted', color: '#059669' },
];

function ReadOnlyColumn({
  label,
  color,
  items,
  onCardClick,
}: {
  label: string;
  color: string;
  items: ContentItem[];
  onCardClick: (item: ContentItem) => void;
}) {
  return (
    <div className={`${tile} p-3`}>
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-neutral-600 dark:text-[#888]">{label}</span>
        <span className="text-[11px] text-neutral-400 dark:text-[#444] ml-auto">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-10 text-xs text-neutral-300 dark:text-[#333]">
          Nothing here yet
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} onCardClick={() => onCardClick(item)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { clients, loading, addContent, updateContent, deleteContent, updateContentStatus, updateClientReview, addComment } = useClients();

  const isAdmin = currentUser?.role === 'admin';
  const isSMM = currentUser?.role === 'social-media-manager';
  const isClientRole = currentUser?.role === 'client';
  const canAdd = isAdmin || isSMM;
  // Must match the condition that renders the draggable board, which is
  // !isClientRole. Gating the handlers on isAdmin||isSMM instead meant any
  // account whose role was blank, legacy or misspelled got the full drag UI
  // with every handler silently returning early — drag looked simply dead.
  // If such an account genuinely lacks permission, the Firestore rules reject
  // the write and runWrite surfaces it, which is a visible failure not a mute
  // one.
  const canMove = !isClientRole;

  const client = clients.find((c) => c.id === id);

  // Must sit above the early returns below — hooks cannot be conditional, and
  // `client` is undefined on the first render while the list loads.
  const { createShare } = useShareActions(client?.id, client?.name ?? '');
  // Decisions made through public links land on the share document; there's no
  // server, so a signed-in team member writes them back onto the item.
  useShareReconciler(client?.id, !isClientRole);

  const [addingToColumn, setAddingToColumn] = useState<ContentStatus | null>(null);
  const [calendarAddDate, setCalendarAddDate] = useState<Date | null>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);
  const [view, setView] = useState<'kanban' | 'calendar' | 'ideas'>('kanban');
  const [convertingIdea, setConvertingIdea] = useState<Idea | null>(null);
  const [mobileTab, setMobileTab] = useState<ContentStatus>(
    currentUser?.role === 'client' ? 'review' : 'editing'
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  if (loading) {
    return (
      <div className={`${page} flex items-center justify-center`}>
        <div className="w-5 h-5 border-2 border-neutral-200 dark:border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className={`${page} flex items-center justify-center`}>
        <div className="text-center">
          <p className="text-neutral-400 dark:text-[#555] mb-4 text-sm">Client not found.</p>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-[#dc2626] hover:text-[#ef4444] transition-colors"
          >
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
    return (client?.content ?? [])
      .filter((item) => item.status === status)
      .sort((a, b) => a.createdAt - b.createdAt);
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
  // reorders the board under the cursor, which fires another drag-over and
  // commits again — a dozen racing Firestore writes per drag, landing the card
  // wherever the last one happened to win. The move belongs on drop; the hover
  // highlight comes from useDroppable's own isOver and needs no state write.
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

  const visibleColumns = isClientRole ? CLIENT_COLUMNS : COLUMNS;

  const clientVisibleContent = isClientRole
    ? client.content.filter((item) => CLIENT_COLUMNS.some((c) => c.id === item.status))
    : client.content;

  const activeMobileCol = visibleColumns.find((c) => c.id === mobileTab) ?? visibleColumns[0];

  const liveSelectedItem = selectedItem
    ? client.content.find((c) => c.id === selectedItem.id) ?? null
    : null;

  return (
    <div className={page}>
      {/* Desktop top nav */}
      <header className="hidden sm:block bg-canvas/85 dark:bg-canvas-dark/85 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center shadow-md shadow-red-900/40">
              <span className="text-white font-bold text-xs leading-none">L</span>
            </div>
            <span className="text-neutral-900 dark:text-white font-bold text-[15px] tracking-tight">Limi</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-neutral-400 dark:text-[#444] text-xs">{currentUser?.email}</span>
            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#888] hover:bg-neutral-100 dark:hover:bg-[#1a1a1a] transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            <button
              onClick={logout}
              className="text-xs text-neutral-500 dark:text-[#666] hover:text-neutral-700 dark:hover:text-[#999] border border-neutral-200 dark:border-[#1e1e1e] hover:border-neutral-300 dark:hover:border-[#2e2e2e] px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header
        className="sm:hidden sticky top-0 z-10 bg-canvas/85 dark:bg-canvas-dark/85 backdrop-blur-xl"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-8 h-8 rounded-xl text-neutral-400 dark:text-[#555] active:bg-neutral-100 dark:active:bg-[#1a1a1a] transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-neutral-900 dark:text-white truncate">{client.name}</h1>
          </div>
          {(
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={`flex items-center justify-center w-7 h-7 rounded-md text-xs transition-colors ${
                  view === 'kanban'
                    ? 'bg-white dark:bg-[#1e1e1e] text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-400 dark:text-[#555]'
                }`}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setView('calendar')}
                className={`flex items-center justify-center w-7 h-7 rounded-md text-xs transition-colors ${
                  view === 'calendar'
                    ? 'bg-white dark:bg-[#1e1e1e] text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-400 dark:text-[#555]'
                }`}
              >
                <CalendarDays size={13} />
              </button>
              <button
                onClick={() => setView('ideas')}
                className={`flex items-center justify-center w-7 h-7 rounded-md text-xs transition-colors ${
                  view === 'ideas'
                    ? 'bg-white dark:bg-[#1e1e1e] text-neutral-800 dark:text-white shadow-sm'
                    : 'text-neutral-400 dark:text-[#555]'
                }`}
              >
                <Lightbulb size={13} />
              </button>
            </div>
          )}
          <button
            onClick={logout}
            className="text-[10px] text-neutral-400 dark:text-[#555] border border-neutral-200 dark:border-[#1e1e1e] px-2.5 py-1 rounded-lg"
          >
            Out
          </button>
        </div>
      </header>

      {/* Desktop client info bar */}
      <div className="hidden sm:block">
        <div className="max-w-[1440px] mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-neutral-400 dark:text-[#444] hover:text-neutral-600 dark:hover:text-[#888] text-xs mb-3 transition-colors"
          >
            <ArrowLeft size={13} />
            All Clients
          </button>

          <div className="flex items-center gap-4 flex-wrap">
            {client.imageUrl ? (
              <img
                src={client.imageUrl}
                alt={client.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-neutral-200 dark:ring-[#1e1e1e]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-neutral-100 dark:bg-[#161616] border border-neutral-200 dark:border-[#222] flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-neutral-400 dark:text-[#444]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-neutral-900 dark:text-white leading-tight">{client.name}</h1>
              {client.about && (
                <p className="text-sm text-neutral-400 dark:text-[#555] mt-0.5 truncate max-w-xl">{client.about}</p>
              )}
            </div>

            {(
              <div className="flex items-center gap-1 bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] rounded-lg p-1">
                <button
                  onClick={() => setView('kanban')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === 'kanban'
                      ? 'bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-800 dark:text-white'
                      : 'text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#888]'
                  }`}
                >
                  <LayoutGrid size={12} />
                  Kanban
                </button>
                <button
                  onClick={() => setView('calendar')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === 'calendar'
                      ? 'bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-800 dark:text-white'
                      : 'text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#888]'
                  }`}
                >
                  <CalendarDays size={12} />
                  Calendar
                </button>
                <button
                  onClick={() => setView('ideas')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    view === 'ideas'
                      ? 'bg-neutral-100 dark:bg-[#1e1e1e] text-neutral-800 dark:text-white'
                      : 'text-neutral-400 dark:text-[#555] hover:text-neutral-600 dark:hover:text-[#888]'
                  }`}
                >
                  <Lightbulb size={12} />
                  Ideas
                </button>
              </div>
            )}

            {!isClientRole && (
              <div className="hidden sm:flex items-center gap-2">
                {COLUMNS.map((col) => {
                  const count = getItemsByStatus(col.id).length;
                  return (
                    <div
                      key={col.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1a1a1a]"
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-xs text-neutral-600 dark:text-[#777] font-medium">{count}</span>
                      <span className="text-xs text-neutral-400 dark:text-[#444]">{col.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-[1440px] mx-auto px-4 sm:px-6 py-4 sm:py-6 pb-24 sm:pb-6">
        {/* Ideas are open to every role — clients submit, the team triages. */}
        {view === 'ideas' ? (
          <IdeasView
            clientId={client.id}
            canTriage={!isClientRole}
            onConvert={(idea) => setConvertingIdea(idea)}
          />
        ) : isClientRole ? (
          view === 'calendar' ? (
            <ContentCalendar
              content={clientVisibleContent}
              canAdd={false}
              onDayClick={() => {}}
              onItemClick={(item) => setSelectedItem(item)}
            />
          ) : (
            <>
              {/* Mobile: stage tabs + single column */}
              <div className="sm:hidden">
                <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
                  {CLIENT_COLUMNS.map((col) => {
                    const count = getItemsByStatus(col.id).length;
                    const isActive = mobileTab === col.id;
                    return (
                      <button
                        key={col.id}
                        onClick={() => setMobileTab(col.id)}
                        className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                          isActive
                            ? ''
                            : 'bg-white dark:bg-[#111] text-neutral-500 dark:text-[#444] border border-neutral-200 dark:border-[#1e1e1e]'
                        }`}
                        style={
                          isActive
                            ? { backgroundColor: `${col.color}22`, color: col.color, border: `1px solid ${col.color}44` }
                            : {}
                        }
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                        {col.label}
                        <span
                          className={`text-[11px] font-bold px-1 rounded ${isActive ? '' : 'text-neutral-400 dark:text-[#333]'}`}
                          style={isActive ? { color: col.color } : {}}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <ReadOnlyColumn
                  label={activeMobileCol.label}
                  color={activeMobileCol.color}
                  items={getItemsByStatus(activeMobileCol.id)}
                  onCardClick={(item) => setSelectedItem(item)}
                />
              </div>

              {/* Desktop: three columns */}
              <div className="hidden sm:grid grid-cols-3 gap-4">
                {CLIENT_COLUMNS.map((col) => (
                  <ReadOnlyColumn
                    key={col.id}
                    label={col.label}
                    color={col.color}
                    items={getItemsByStatus(col.id)}
                    onCardClick={(item) => setSelectedItem(item)}
                  />
                ))}
              </div>
            </>
          )
        ) : view === 'calendar' ? (
          <ContentCalendar
            content={client.content}
            canAdd={canAdd}
            onDayClick={(date) => setCalendarAddDate(date)}
            onItemClick={(item) => setSelectedItem(item)}
          />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveItem(null)}
          >
            {/* Mobile: status tabs + single column */}
            <div className="sm:hidden">
              <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-1 px-1 scrollbar-none">
                {COLUMNS.map((col) => {
                  const count = getItemsByStatus(col.id).length;
                  const isActive = mobileTab === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setMobileTab(col.id)}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                        isActive
                          ? ''
                          : 'bg-white dark:bg-[#111] text-neutral-500 dark:text-[#444] border border-neutral-200 dark:border-[#1e1e1e]'
                      }`}
                      style={
                        isActive
                          ? { backgroundColor: `${col.color}22`, color: col.color, border: `1px solid ${col.color}44` }
                          : {}
                      }
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                      {col.label}
                      <span
                        className={`text-[11px] font-bold px-1 rounded ${isActive ? '' : 'text-neutral-400 dark:text-[#333]'}`}
                        style={isActive ? { color: col.color } : {}}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <KanbanColumn
                id={activeMobileCol.id}
                label={activeMobileCol.label}
                color={activeMobileCol.color}
                items={getItemsByStatus(activeMobileCol.id)}
                canAdd={canAdd}
                canEditItem={canEditItem}
                canDeleteItem={canDeleteItem}
                onAddContent={(status) => setAddingToColumn(status)}
                onCardClick={(item) => setSelectedItem(item)}
                onEditCard={(item) => setEditingItem(item)}
                onDeleteCard={(item) => setSelectedItem(item)}
              />
            </div>

            {/* Desktop: 4-column grid */}
            <div className="hidden sm:grid grid-cols-2 xl:grid-cols-4 gap-4">
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

            <DragOverlay>
              {activeItem ? <ContentCard item={activeItem} isOverlay /> : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

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

      {/* Read the item back out of the live list rather than trusting the
          snapshot held in state, so the sheet reflects a stage change or a
          review decision instead of showing what was true when it opened. */}
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
