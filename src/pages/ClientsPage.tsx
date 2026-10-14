import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { Client } from '../types';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import ClientFolder from '../components/ClientFolder';
import { enter, staggerStyle } from '../motion';
import ClientModal from '../components/ClientModal';
import NotifPermissionBanner from '../components/NotifPermissionBanner';
import { useNotifications } from '../hooks/useNotifications';
import Dashboard from '../components/Dashboard';
import { runWrite } from '../utils';
import {
  shell, heading, faintText, btnPrimary, card, emptyState, emptyTitle, emptyBody, btnWarningSm,
} from '../ui';

// The brand, theme toggle, Team link and sign-out all live in AppShell's
// sidebar now, so this page renders only its own content.
export default function ClientsPage() {
  const {
    clients, loading, addClient, updateClient,
    pendingMigration, migrateLegacyContent,
    pendingCaptionMigration, migrateLegacyCaptions,
    pendingBusinessMigration, migrateBusinesses,
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

  async function handleBusinessMigrate() {
    setMigrating(true);
    await runWrite(async () => {
      const stamped = await migrateBusinesses();
      alert(
        `Every client now has a business. ${stamped} existing content item${stamped === 1 ? ' was' : 's were'} filed under ${stamped === 1 ? 'its' : 'their'} client's first business.`
      );
    }, 'set up businesses');
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

  const banner = 'mb-5 rounded-card border border-warning/30 dark:border-warning-textdark/25 bg-warning-soft dark:bg-warning-softdark p-4';
  const bannerBtn = `mt-3 ${btnWarningSm}`;

  return (
    // The shell no longer scrolls, so this page owns its scroll region.
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className={`${shell} py-6`}>
      {showStats && <NotifPermissionBanner />}

      {isAdmin && pendingMigration.length === 0 && pendingCaptionMigration.length > 0 && (
        <div className={banner}>
          <h2 className="text-sm font-semibold text-warning-text dark:text-warning-textdark">
            Captions need moving
          </h2>
          <p className="text-xs text-ink-soft dark:text-ink-softdark mt-1 leading-relaxed">
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
          <h2 className="text-sm font-semibold text-warning-text dark:text-warning-textdark">
            Content needs migrating
          </h2>
          <p className="text-xs text-ink-soft dark:text-ink-softdark mt-1 leading-relaxed">
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

      {/* Clients still waiting on the content migration are left out of this
          one (their old items are not in the subcollection yet), but they do
          not hold it back for everyone else. */}
      {isAdmin && pendingBusinessMigration.length > 0 && (
        <div className={banner}>
          <h2 className="text-sm font-semibold text-warning-text dark:text-warning-textdark">
            Set up businesses
          </h2>
          <p className="text-xs text-ink-soft dark:text-ink-softdark mt-1 leading-relaxed">
            A client can now run more than one business, each with its own content and
            campaigns. {pendingBusinessMigration.length} client
            {pendingBusinessMigration.length === 1 ? ' needs' : 's need'} a first business, named
            after the client, with existing content filed under it. Nothing on the boards
            changes, and it is safe to run twice.
          </p>
          <button onClick={handleBusinessMigrate} disabled={migrating} className={bannerBtn}>
            {migrating ? 'Setting up…' : 'Set up businesses'}
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
        // Folders in a grid, like Finder or OneDrive: as many columns as fit,
        // each at least 132px, entering in a quick stagger.
        <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3 gap-y-4 sm:gap-x-4">
          {visibleClients.map((client, i) => (
            <div key={client.id} className={enter} style={staggerStyle(i)}>
              <ClientFolder
                client={client}
                onEdit={canManageClients ? () => setEditingClient(client) : undefined}
              />
            </div>
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
    </div>
  );
}
