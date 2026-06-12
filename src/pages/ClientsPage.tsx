import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useClients } from '../store';
import ClientCard from '../components/ClientCard';
import AddClientModal from '../components/AddClientModal';

export default function ClientsPage() {
  const { clients, addClient } = useClients();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <header className="border-b border-[#1e1e1e] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-white tracking-tight">Limi</h1>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add Client
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center mb-4">
              <Plus size={24} className="text-[#555]" />
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">No clients yet</h2>
            <p className="text-sm text-[#888] mb-6">Add your first client to get started.</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#5558e3] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              <Plus size={16} />
              Add Client
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-[#888] mb-6">
              {clients.length} client{clients.length !== 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => (
                <ClientCard key={client.id} client={client} />
              ))}
            </div>
          </>
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
