import { useState } from 'react';
import { Plus, Users } from 'lucide-react';
import { useClients } from '../store';
import { useAuth } from '../contexts/AuthContext';
import ClientCard from '../components/ClientCard';
import AddClientModal from '../components/AddClientModal';

function Header() {
  const { userEmail, logout } = useAuth();
  return (
    <header className="border-b border-[#161616] bg-[#080808] sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
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
  );
}

export default function ClientsPage() {
  const { clients, loading, addClient } = useClients();
  const [showModal, setShowModal] = useState(false);

  const totalContent = clients.reduce((sum, c) => sum + c.content.length, 0);

  return (
    <div className="min-h-screen bg-[#080808]">
      <Header />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Clients</h1>
            {!loading && clients.length > 0 && (
              <p className="text-sm text-[#555] mt-1">
                {clients.length} client{clients.length !== 1 ? 's' : ''}
                &nbsp;&middot;&nbsp;
                {totalContent} piece{totalContent !== 1 ? 's' : ''} of content
              </p>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-red-900/30"
          >
            <Plus size={15} />
            New Client
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-5 h-5 border-2 border-[#222] border-t-[#dc2626] rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#1e1e1e] flex items-center justify-center mb-4">
              <Users size={24} className="text-[#333]" />
            </div>
            <h2 className="text-base font-semibold text-white mb-2">No clients yet</h2>
            <p className="text-sm text-[#444] mb-6 max-w-xs leading-relaxed">
              Add your first client to start managing their content pipeline.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#dc2626] hover:bg-[#b91c1c] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors"
            >
              <Plus size={15} />
              New Client
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )}
      </main>

      {showModal && (
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
