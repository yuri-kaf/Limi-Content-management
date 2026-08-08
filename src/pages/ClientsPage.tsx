import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Sun, Moon } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import ClientCard from '../components/ClientCard';
import AddClientModal from '../components/AddClientModal';
import NotifPermissionBanner from '../components/NotifPermissionBanner';
import { useNotifications } from '../hooks/useNotifications';
import Dashboard from '../components/Dashboard';
import { runWrite } from '../utils';
import { shell, heading, badge, page, btnGhost, btnIcon } from '../ui';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  'social-media-manager': 'SMM',
  client: 'Client',
};

function Header() {
  const { currentUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="bg-canvas/85 dark:bg-canvas-dark/85 backdrop-blur-xl sticky top-0 z-10"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className={`${shell} py-4 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center shadow-pill">
            <span className="text-white font-bold text-xs leading-none">L</span>
          </div>
          <span className={`${heading} text-[15px]`}>Limi</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser && (
            <span
              className={`${badge} ${
                isAdmin
                  ? 'bg-brand-soft dark:bg-brand-softdark text-brand'
                  : 'bg-raised dark:bg-raised-dark text-ink-soft dark:text-ink-softdark'
              }`}
            >
              {ROLE_LABELS[currentUser.role] ?? currentUser.role}
            </span>
          )}
          {/* Theme toggle */}
          <button onClick={toggleTheme} className={btnIcon} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          {/* Team button: only on desktop */}
          <button
            onClick={() => navigate('/users')}
            className={`${btnGhost} hidden sm:inline-flex h-9 min-h-0 px-3.5 text-xs`}
          >
            Team
          </button>
          <button onClick={logout} className={`${btnGhost} h-9 min-h-0 px-3.5 text-xs`}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

export default function ClientsPage() {
  const {
    clients, loading, addClient,
    pendingMigration, migrateLegacyContent,
    pendingCaptionMigration, migrateLegacyCaptions,
  } = useClients();
  const { currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);
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
    const ok = await runWrite(async () => {
      const moved = await migrateLegacyContent();
      alert(`Moved ${moved} content item${moved === 1 ? '' : 's'} into the new structure.`);
    }, 'migrate the content');
    setMigrating(false);
    if (!ok) return;
  }

  const isAdmin = currentUser?.role === 'admin';
  const isSMM = currentUser?.role === 'social-media-manager';
  const isClientRole = currentUser?.role === 'client';
  const canAddClient = isAdmin;
  const showStats = isAdmin || isSMM;

  const visibleClients = isClientRole
    ? clients.filter((c) => currentUser?.assignedClientIds?.includes(c.id))
    : clients;

  useNotifications(isClientRole ? [] : visibleClients);

  const totalContent = visibleClients.reduce((sum, c) => sum + c.content.length, 0);

  return (
    <div className={page}>
      <Header />

      <main className={`${shell} py-6 sm:py-8 pb-24 sm:pb-8`}>
        {showStats && <NotifPermissionBanner />}

        {isAdmin && pendingMigration.length === 0 && pendingCaptionMigration.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-[#1a1405] p-4">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Captions need moving
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/60 mt-1 leading-relaxed">
              {pendingCaptionMigration.length} item
              {pendingCaptionMigration.length === 1 ? '' : 's'} still keep their caption in the
              old notes field. Moving them frees up Team Notes for internal remarks the client
              can't see. Your text is copied across, not retyped.
            </p>
            <button
              onClick={handleCaptionMigrate}
              disabled={migrating}
              className="mt-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {migrating ? 'Moving…' : 'Move captions now'}
            </button>
          </div>
        )}

        {isAdmin && pendingMigration.length > 0 && (
          <div className="mb-5 rounded-xl border border-amber-300 dark:border-amber-900/50 bg-amber-50 dark:bg-[#1a1405] p-4">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              Content needs migrating
            </h2>
            <p className="text-xs text-amber-800/80 dark:text-amber-200/60 mt-1 leading-relaxed">
              {pendingMigration.length} client{pendingMigration.length === 1 ? '' : 's'} still
              store content in the old format. Move it to the new structure to enable comments,
              versions and per-item permissions. Your existing data is copied, not deleted, so
              this is safe to run and safe to repeat.
            </p>
            <button
              onClick={handleMigrate}
              disabled={migrating}
              className="mt-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              {migrating ? 'Migrating…' : 'Migrate content now'}
            </button>
          </div>
        )}

        {!loading && visibleClients.length > 0 && currentUser && (
          <Dashboard clients={visibleClients} role={currentUser.role} />
        )}

        {/* Page header */}
        <div className="flex items-start justify-between mb-5 sm:mb-8">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-neutral-900 dark:text-white tracking-tight">
              {isClientRole ? 'My Boards' : 'Clients'}
            </h1>
            {!loading && visibleClients.length > 0 && (
              <p className="text-sm text-neutral-400 dark:text-[#555] mt-0.5">
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
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-red-900/30"
            >
              <Plus size={15} />
              <span className="hidden sm:inline">New Client</span>
              <span className="sm:hidden">New</span>
            </button>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-5 h-5 border-2 border-neutral-200 dark:border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
          </div>
        ) : visibleClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#111] border border-neutral-200 dark:border-[#1e1e1e] flex items-center justify-center mb-4">
              <Users size={24} className="text-neutral-300 dark:text-[#333]" />
            </div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-white mb-2">
              {isClientRole ? 'No boards assigned yet' : 'No clients yet'}
            </h2>
            <p className="text-sm text-neutral-400 dark:text-[#444] mb-6 max-w-xs leading-relaxed">
              {isClientRole
                ? 'Your admin will assign client boards to you.'
                : 'Add your first client to start managing their content pipeline.'}
            </p>
            {canAddClient && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
              >
                <Plus size={15} />
                New Client
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {visibleClients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </main>

      {showModal && (isAdmin || isSMM) && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onAdd={async (data) => {
            const ok = await runWrite(() => addClient(data), 'add the client');
            if (ok) setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
