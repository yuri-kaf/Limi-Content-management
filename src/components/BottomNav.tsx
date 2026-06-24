import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutGrid, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser } = useAuth();

  const isAdmin = currentUser?.role === 'admin';
  const isOnHome = location.pathname === '/';
  const isOnUsers = location.pathname === '/users';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 sm:hidden bg-white/95 dark:bg-[#080808]/95 border-t border-neutral-200 dark:border-[#1a1a1a] backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center">
        <button
          onClick={() => navigate('/')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors active:opacity-70 ${
            isOnHome ? 'text-[#dc2626]' : 'text-neutral-400 dark:text-[#444]'
          }`}
        >
          <LayoutGrid size={22} strokeWidth={isOnHome ? 2.5 : 1.8} />
          <span className="text-[10px] font-semibold tracking-wide">Home</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => navigate('/users')}
            className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors active:opacity-70 ${
              isOnUsers ? 'text-[#dc2626]' : 'text-neutral-400 dark:text-[#444]'
            }`}
          >
            <Users size={22} strokeWidth={isOnUsers ? 2.5 : 1.8} />
            <span className="text-[10px] font-semibold tracking-wide">Team</span>
          </button>
        )}
      </div>
    </nav>
  );
}
