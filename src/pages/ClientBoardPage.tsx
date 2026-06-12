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
import { useClients } from '../store';
import { ContentStatus, ContentItem } from '../types';
import KanbanColumn from '../components/KanbanColumn';
import AddContentModal from '../components/AddContentModal';
import ContentCard from '../components/ContentCard';

const COLUMNS: { id: ContentStatus; label: string; color: string }[] = [
  { id: 'editing', label: 'Under Editing', color: '#f59e0b' },
  { id: 'review', label: 'Under Review', color: '#3b82f6' },
  { id: 'to-post', label: 'To Post', color: '#8b5cf6' },
  { id: 'posted', label: 'Posted', color: '#10b981' },
];

export default function ClientBoardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, addContent, updateContentStatus } = useClients();

  const client = clients.find((c) => c.id === id);

  const [addingToColumn, setAddingToColumn] = useState<ContentStatus | null>(null);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  if (!client) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#888] mb-4">Client not found.</p>
          <button
            onClick={() => navigate('/')}
            className="text-[#6366f1] hover:underline text-sm"
          >
            Go back home
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
      const activeItem = client.content.find((c) => c.id === activeId);
      if (activeItem && activeItem.status !== overColumn.id) {
        updateContentStatus(client.id, activeId, overColumn.id);
      }
      return;
    }

    const overItem = client.content.find((c) => c.id === overId);
    const activeItem2 = client.content.find((c) => c.id === activeId);
    if (overItem && activeItem2 && activeItem2.status !== overItem.status) {
      updateContentStatus(client.id, activeId, overItem.status);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveItem(null);
    const { active, over } = event;
    if (!over || !client) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeItemData = client.content.find((c) => c.id === activeId);
    const overColumn = COLUMNS.find((col) => col.id === overId);

    if (overColumn && activeItemData && activeItemData.status !== overColumn.id) {
      updateContentStatus(client.id, activeId, overColumn.id);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <header className="border-b border-[#1e1e1e] px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-[#888] hover:text-white text-sm mb-4 transition-colors"
          >
            <ArrowLeft size={15} />
            All Clients
          </button>

          <div className="flex items-center gap-4">
            {client.imageUrl ? (
              <img
                src={client.imageUrl}
                alt={client.name}
                className="w-14 h-14 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center flex-shrink-0">
                <User size={22} className="text-[#888]" />
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-white">{client.name}</h1>
              {client.about && (
                <p className="text-sm text-[#888] mt-0.5 max-w-xl">{client.about}</p>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
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
              />
            ))}
          </div>

          <DragOverlay>
            {activeItem ? <ContentCard item={activeItem} /> : null}
          </DragOverlay>
        </DndContext>
      </main>

      {addingToColumn && (
        <AddContentModal
          defaultStatus={addingToColumn}
          onClose={() => setAddingToColumn(null)}
          onAdd={(data) => {
            addContent(client.id, data);
            setAddingToColumn(null);
          }}
        />
      )}
    </div>
  );
}
