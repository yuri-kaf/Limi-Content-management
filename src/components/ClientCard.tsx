import { Client } from '../types';
import { useNavigate } from 'react-router-dom';
import { User, ChevronRight } from 'lucide-react';

const STATUS_META: Record<string, { color: string; label: string }> = {
  editing:  { color: '#d97706', label: 'Editing' },
  review:   { color: '#2563eb', label: 'Review' },
  'to-post':{ color: '#dc2626', label: 'To Post' },
  posted:   { color: '#059669', label: 'Posted' },
};

const STATUS_ORDER = ['editing', 'review', 'to-post', 'posted'];

interface Props {
  client: Client;
}

export default function ClientCard({ client }: Props) {
  const navigate = useNavigate();

  const statusCounts = client.content.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const hasContent = client.content.length > 0;

  return (
    <button
      onClick={() => navigate(`/client/${client.id}`)}
      className="group w-full text-left bg-[#111] border border-[#1e1e1e] hover:border-[#2c2c2c] rounded-2xl p-5 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#dc2626]/30 hover:bg-[#131313]"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {client.imageUrl ? (
            <img
              src={client.imageUrl}
              alt={client.name}
              className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-[#1e1e1e]"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-[#1a1a1a] border border-[#252525] flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-[#444]" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-semibold text-[#f0f0f0] truncate text-[15px] leading-tight">
              {client.name}
            </h3>
            <span className="text-xs text-[#444] mt-0.5 block">
              {client.content.length} item{client.content.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <ChevronRight
          size={15}
          className="text-[#2a2a2a] group-hover:text-[#555] transition-colors flex-shrink-0 mt-1.5"
        />
      </div>

      {/* About */}
      {client.about && (
        <p className="text-sm text-[#555] line-clamp-2 leading-relaxed mb-3">
          {client.about}
        </p>
      )}

      {/* Status breakdown */}
      {hasContent && (
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[#181818]">
          {STATUS_ORDER.filter((s) => statusCounts[s]).map((status) => (
            <div
              key={status}
              className="flex items-center gap-1 px-2 py-1 rounded-md"
              style={{ backgroundColor: `${STATUS_META[status].color}12` }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: STATUS_META[status].color }}
              />
              <span className="text-xs" style={{ color: STATUS_META[status].color, opacity: 0.9 }}>
                {statusCounts[status]} {STATUS_META[status].label}
              </span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
