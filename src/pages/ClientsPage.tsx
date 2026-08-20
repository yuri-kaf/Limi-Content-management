import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Client } from '../types';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import ClientCard from '../components/ClientCard';
import ClientModal from '../components/ClientModal';
import NotifPermissionBanner from '../components/NotifPermissionBanner';
import { useNotifications } from '../hooks/useNotifications';
import Dashboard from '../components/Dashboard';
import { runWrite } from '../utils';
import {
  shell, heading, faintText, btnPrimary, card, emptyState, emptyTitle, emptyBody,
} from '../ui';

// The brand, theme toggle, Team link and sign-out all live in AppShell's
// sidebar now, so this page renders only its own content.
export default function ClientsPage() {
  const {
    clients, loading, addClient, updateClient,
    pendingMigration, migrateLegacyContent,
    pendingCaptionMigration, migrateLegacyCaptions,
  } = useClients();
  const { currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
  // The client being edited, or null when the modal is creating a new one.
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [migrating, setMigrating] = useState(false);

  async function handleCaptionMigrate() {
    setMigrating(true);
    await runWrite(async () => {
      const moved = await migrateLegacyCaptions();
      alert(`Moved ${moved} caption${moved === 1 ? '' : 's'} into the new Caption field.`);
    }, 'migrate the captions');
    setMigrating(false);
  }

  async function handleMigrate() {
    setMigrating(true);
    await runWrite(async () => {
      const moved = await migrateLegacyContent();
      alert(`Moved ${moved} content item${moved === 1 ? '' : 's'} into the new structure.`);
    }, 'migrate the content');
    setMigrating(false);
  }

  const isAdmin = currentUser?.role === 'admin';
  const isSMM = currentUser?.role === 'social-media-manager';
  const isClientRole = currentUser?.role === 'client';
  const canAddClient = isAdmin;
  // Rules allow an admin or a manager to write a client document, so editing
  // matches that rather than being narrower for no reason.
  const canManageClients = isAdmin || isSMM;
  const showStats = isAdmin || isSMM;

  const visibleClients = isClientRole
    ? clients.filter((c) => currentUser?.assignedClientIds?.includes(c.id))
    : clients;

  useNotifications(isClientRole ? [] : visibleClients);

  const totalContent = visibleClients.reduce((sum, c) => sum + c.content.length, 0);

  const banner = 'mb-5 rounded-card border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-4';
  const bannerBtn = 'mt-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-tile transition-colors';

  return (
    <div className={`${shell} py-6`}>
      {showStats && <NotifPermissionBanner />}

      {isAdmin && pendingMigration.length === 0 && pendingCaptionMigration.length > 0 && (
        <div className={banner}>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Captions need moving
          </h2>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/60 mt-1 leading-relaxed">
            {pendingCaptionMigration.length} item
            {pendingCaptionMigration.length === 1 ? '' : 's'} still keep their caption in the
            old notes field. Moving them frees up Team Notes for internal remarks the client
            can't see. Your text is copied across, not retyped.
          </p>
          <button onClick={handleCaptionMigrate} disabled={migrating} className={bannerBtn}>
            {migrating ? 'Moving…' : 'Move captions now'}
          </button>
        </div>
      )}

      {isAdmin && pendingMigration.length > 0 && (
        <div className={banner}>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Content needs migrating
          </h2>
          <p className="text-xs text-amber-800/80 dark:text-amber-200/60 mt-1 leading-relaxed">
            {pendingMigration.length} client{pendingMigration.length === 1 ? '' : 's'} still
            store content in the old format. Move it to the new structure to enable comments,
            versions and per-item permissions. Your existing data is copied, not deleted, so
            this is safe to run and safe to repeat.
          </p>
          <button onClick={handleMigrate} disabled={migrating} className={bannerBtn}>
            {migrating ? 'Migrating…' : 'Migrate content now'}
          </button>
        </div>
      )}

      {!loading && visibleClients.length > 0 && currentUser && (
        <Dashboard clients={visibleClients} role={currentUser.role} />
      )}

      {/* Page header */}
      <div className="flex items-start justify-between mb-5 sm:mb-6">
        <div>
          <h1 className={`${heading} text-lg`}>
            {isClientRole ? 'My Boards' : 'Clients'}
          </h1>
          {!loading && visibleClients.length > 0 && (
            <p className={`text-[13px] mt-0.5 ${faintText}`}>
              {visibleClients.length} client{visibleClients.length !== 1 ? 's' : ''}
              {!isClientRole && (
                <>
                  &nbsp;&middot;&nbsp;
                  {totalContent} piece{totalContent !== 1 ? 's' : ''} of content
                </>
              )}
            </p>
          )}
        </div>
        {canAddClient && (
          <button onClick={() => setShowModal(true)} className={`${btnPrimary} h-9 min-h-0`}>
            <Plus size={14} />
            <span className="hidden sm:inline">New client</span>
            <span className="sm:hidden">New</span>
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-32">
          <div className="w-5 h-5 border-2 border-hairline dark:border-hairline-dark border-t-brand rounded-full animate-spin" />
        </div>
      ) : visibleClients.length === 0 ? (
        <div className={emptyState}>
          <div className={`${card} w-12 h-12 flex items-center justify-center`}>
            <Users size={20} className={faintText} />
          </div>
          <p className={emptyTitle}>
            {isClientRole ? 'No boards assigned yet' : 'No clients yet'}
          </p>
          <p className={emptyBody}>
            {isClientRole
              ? 'Your admin will assign client boards to you. They will appear here and in the sidebar.'
              : 'A client is a board of content with its own review loop. Add your first one to start scheduling posts.'}
          </p>
          {canAddClient && (
            <button onClick={() => setShowModal(true)} className={`${btnPrimary} mt-2 h-9 min-h-0`}>
              <Plus size={14} />
              Add client
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {visibleClients.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              onEdit={canManageClients ? () => setEditingClient(client) : undefined}
            />
          ))}
        </div>
      )}

      {editingClient && canManageClients && (
        <ClientModal
          client={editingClient}
          onClose={() => setEditingClient(null)}
          onSave={async (data) => {
            await runWrite(() => updateClient(editingClient.id, data), 'save the client');
            setEditingClient(null);
          }}
        />
      )}

      {showModal && (isAdmin || isSMM) && (
        <ClientModal
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            const ok = await runWrite(() => addClient(data), 'add the client');
            if (ok) setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
