import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Users, Video, CheckCircle, XCircle } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import { Client } from '../types';
import ClientCard from '../components/ClientCard';
import AddClientModal from '../components/AddClientModal';

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  'social-media-manager': 'SMM',
  client: 'Client',
};

function Header() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.role === 'admin';

  return (
    <header className="border-b border-[#161616] bg-[#080808] sticky top-0 z-10"
            style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center shadow-md shadow-red-900/40">
            <span className="text-white font-bold text-xs leading-none">L</span>
          </div>
          <span className="text-white font-bold text-[15px] tracking-tight">Limi</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {currentUser && (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                color: isAdmin ? '#dc2626' : '#888',
                backgroundColor: isAdmin ? '#dc262620' : '#1a1a1a',
              }}
            >
              {ROLE_LABELS[currentUser.role] ?? currentUser.role}
            </span>
          )}
          {/* Team button: only on desktop — on mobile it's in the bottom tab bar */}
          <button
            onClick={() => navigate('/users')}
            className="hidden sm:block text-xs text-[#666] hover:text-[#999] border border-[#1e1e1e] hover:border-[#2e2e2e] px-3 py-1.5 rounded-lg transition-colors"
          >
            Team
          </button>
          <button
            onClick={logout}
            className="text-xs text-[#666] hover:text-[#999] border border-[#1e1e1e] hover:border-[#2e2e2e] px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

function SMMDashboard({ clients }: { clients: Client[] }) {
  const allContent = clients.flatMap((c) => c.content);
  const toPostCount = allContent.filter((i) => i.status === 'to-post').length;
  const approvedCount = allContent.filter((i) => i.clientReview === 'approved').length;
  const declinedCount = allContent.filter((i) => i.clientReview === 'declined').length;

  return (
    <div className="grid grid-cols-3 gap-2.5 mb-6">
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 sm:p-4 flex flex-col gap-1.5">
        <Video size={14} className="text-[#dc2626]" />
        <span className="text-2xl sm:text-3xl font-bold text-white tabular-nums leading-none">
          {toPostCount}
        </span>
        <span className="text-[10px] sm:text-xs text-[#555] leading-tight">Ready to Post</span>
      </div>
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 sm:p-4 flex flex-col gap-1.5">
        <CheckCircle size={14} className="text-emerald-500" />
        <span className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums leading-none">
          {approvedCount}
        </span>
        <span className="text-[10px] sm:text-xs text-[#555] leading-tight">Client Approved</span>
      </div>
      <div className="bg-[#111] border border-[#1e1e1e] rounded-xl p-3 sm:p-4 flex flex-col gap-1.5">
        <XCircle size={14} className="text-red-500" />
        <span className="text-2xl sm:text-3xl font-bold text-red-400 tabular-nums leading-none">
          {declinedCount}
        </span>
        <span className="text-[10px] sm:text-xs text-[#555] leading-tight">Client Declined</span>
      </div>
    </div>
  );
}

export default function ClientsPage() {
  const { clients, loading, addClient } = useClients();
  const { currentUser } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const isAdmin = currentUser?.role === 'admin';
  const isSMM = currentUser?.role === 'social-media-manager';
  const isClientRole = currentUser?.role === 'client';
  const canAddClient = isAdmin;
  const showStats = isAdmin || isSMM;

  const visibleClients = isClientRole
    ? clients.filter((c) => currentUser?.assignedClientIds?.includes(c.id))
    : clients;

  const totalContent = visibleClients.reduce((sum, c) => sum + c.content.length, 0);

  return (
    <div className="min-h-screen min-h-dvh bg-[#080808]">
      <Header />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-8">
        {/* SMM / Admin summary stats */}
        {showStats && !loading && visibleClients.length > 0 && (
          <SMMDashboard clients={visibleClients} />
        )}

        {/* Page header */}
        <div className="flex items-start justify-between mb-5 sm:mb-8">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
              {isClientRole ? 'My Boards' : 'Clients'}
            </h1>
            {!loading && visibleClients.length > 0 && (
              <p className="text-sm text-[#555] mt-0.5">
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
            <div className="w-5 h-5 border-2 border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
          </div>
        ) : visibleClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center mb-4">
              <Users size={24} className="text-[#333]" />
            </div>
            <h2 className="text-base font-semibold text-white mb-2">
              {isClientRole ? 'No boards assigned yet' : 'No clients yet'}
            </h2>
            <p className="text-sm text-[#444] mb-6 max-w-xs leading-relaxed">
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
          onAdd={(data) => {
            addClient(data);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
