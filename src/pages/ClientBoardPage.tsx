import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import { ArrowLeft, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useClients } from '../store';
import { ContentStatus, ContentItem } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import AddContentModal from '../components/AddContentModal';
import ContentDetailModal from '../components/ContentDetailModal';
import ContentCard from '../components/ContentCard';

const COLUMNS: { id: ContentStatus; label: string; color: string }[] = [
  { id: 'editing', label: 'Editing', color: '#d97706' },
  { id: 'review', label: 'Review', color: '#2563eb' },
  { id: 'to-post', label: 'To Post', color: '#dc2626' },
  { id: 'posted', label: 'Posted', color: '#059669' },
];

export default function ClientBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userEmail, logout } = useAuth();
  const { clients, loading, addContent, updateContent, deleteContent, updateContentStatus } = useClients();

  const client = clients.find((c) => c.id === id);
  const [addingToColumn, setAddingToColumn] = useState<ContentStatus | null>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  const [editingItem, setEditingItem] = useState<ContentItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#555] mb-4 text-sm">Client not found.</p>
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

  function getItemsByStatus(status: ContentStatus): ContentItem[] {
    return (client?.content ?? [])
      .filter((item) => item.status === status)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  function handleDragStart(event: DragStartEvent) {
    const item = client?.content.find((c) => c.id === event.active.id);
    if (item) setActiveItem(item);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !client) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const overColumn = COLUMNS.find((col) => col.id === overId);
    if (overColumn) {
      const activeEl = client.content.find((c) => c.id === activeId);
      if (activeEl && activeEl.status !== overColumn.id)
        updateContentStatus(client.id, activeId, overColumn.id);
      return;
    }
    const overItem = client.content.find((c) => c.id === overId);
    const activeEl2 = client.content.find((c) => c.id === activeId);
    if (overItem && activeEl2 && activeEl2.status !== overItem.status)
      updateContentStatus(client.id, activeId, overItem.status);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !client) return;
    const activeId = active.id as string;
    const overId = over.id as string;
    const activeItemData = client.content.find((c) => c.id === activeId);
    const overColumn = COLUMNS.find((col) => col.id === overId);
    if (overColumn && activeItemData && activeItemData.status !== overColumn.id)
      updateContentStatus(client.id, activeId, overColumn.id);
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

  function handleDeleteFromCard(item: ContentItem) {
    setSelectedItem(item);
  }

  return (
    <div className="min-h-screen bg-[#080808]">
      {/* Top nav */}
      <header className="border-b border-[#161616] bg-[#080808] sticky top-0 z-10">
        <div className="max-w-[1440px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center shadow-md shadow-red-900/40">
              <span className="text-white font-bold text-xs leading-none">L</span>
            </div>
            <span className="text-white font-bold text-[15px] tracking-tight">Limi</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[#444] text-xs hidden sm:block">{userEmail}</span>
            <button
              onClick={logout}
              className="text-xs text-[#666] hover:text-[#999] border border-[#1e1e1e] hover:border-[#2e2e2e] px-3 py-1.5 rounded-lg transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Client info bar */}
      <div className="border-b border-[#161616] bg-[#0a0a0a]">
        <div className="max-w-[1440px] mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#444] hover:text-[#888] text-xs mb-3 transition-colors"
          >
            <ArrowLeft size={13} />
            All Clients
          </button>

          <div className="flex items-center gap-4">
            {client.imageUrl ? (
              <img
                src={client.imageUrl}
                alt={client.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0 ring-2 ring-[#1e1e1e]"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-[#161616] border border-[#222] flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-[#444]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-white leading-tight">{client.name}</h1>
              {client.about && (
                <p className="text-sm text-[#555] mt-0.5 truncate max-w-xl">{client.about}</p>
              )}
            </div>

            {/* Status counts */}
            <div className="hidden sm:flex items-center gap-2">
              {COLUMNS.map((col) => {
                const count = getItemsByStatus(col.id).length;
                return (
                  <div
                    key={col.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111] border border-[#1a1a1a]"
                  >
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs text-[#777] font-medium">{count}</span>
                    <span className="text-xs text-[#444]">{col.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Board */}
      <main className="max-w-[1440px] mx-auto px-6 py-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                color={col.color}
                items={getItemsByStatus(col.id)}
                onAddContent={(status) => setAddingToColumn(status)}
                onCardClick={(item) => setSelectedItem(item)}
                onEditCard={(item) => setEditingItem(item)}
                onDeleteCard={(item) => handleDeleteFromCard(item)}
              />
            ))}
          </div>

          <DragOverlay>
            {activeItem ? <ContentCard item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {/* Add content modal */}
      {addingToColumn && (
        <AddContentModal
          defaultStatus={addingToColumn}
          onClose={() => setAddingToColumn(null)}
          onSubmit={(data) => {
            addContent(client.id, data);
            setAddingToColumn(null);
          }}
        />
      )}

      {/* Edit content modal */}
      {editingItem && (
        <AddContentModal
          defaultStatus={editingItem.status}
          existingItem={editingItem}
          onClose={() => setEditingItem(null)}
          onSubmit={(data) => {
            updateContent(client.id, editingItem.id, {
              title: data.title,
              driveLink: data.driveLink,
              driveFileId: data.driveFileId,
              notes: data.notes,
              scheduledAt: data.scheduledAt,
            });
            setEditingItem(null);
          }}
        />
      )}

      {/* Detail modal */}
      {selectedItem && (
        <ContentDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={handleEditFromDetail}
          onDelete={handleDeleteFromDetail}
        />
      )}
    </div>
  );
}
