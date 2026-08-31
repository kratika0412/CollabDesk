import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-6 py-3">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm font-semibold text-slate-100 hover:text-sky-400"
        >
          <span className="rounded-md bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30">
            Sync
          </span>
          <span>Space</span>
        </button>
        <div className="flex items-center gap-4 text-sm">
          <span className="hidden text-slate-400 sm:inline">{user?.email}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t border-slate-900/60 px-6 py-3 text-xs text-slate-500">
        <div className="flex items-center justify-between">
          <span>SyncSpace MVP</span>
          <span className="hidden sm:inline">
            Built for real-time notes &amp; team chat.
          </span>
        </div>
      </footer>
    </div>
  );
}

