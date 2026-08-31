import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900/70 p-8 shadow-xl shadow-slate-900/50 ring-1 ring-slate-800">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Sync<span className="text-sky-400">Space</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Real-time collaborative workspaces.</p>
        </div>
        <Outlet />
      </div>
    </div>
  );
}

