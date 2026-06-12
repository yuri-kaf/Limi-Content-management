import { Client } from '../types';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';

interface Props {
  client: Client;
}

export default function ClientCard({ client }: Props) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/client/${client.id}`)}
      className="w-full text-left bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 hover:bg-[#222] transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[#6366f1]"
    >
      <div className="flex items-center gap-3 mb-3">
        {client.imageUrl ? (
          <img
            src={client.imageUrl}
            alt={client.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0">
            <User size={20} className="text-[#888]" />
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate">{client.name}</h3>
          <span className="text-xs text-[#888]">
            {client.content.length} item{client.content.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
      {client.about && (
        <p className="text-sm text-[#888] line-clamp-2 leading-relaxed">
          {client.about}
        </p>
      )}
    </button>
  );
}
