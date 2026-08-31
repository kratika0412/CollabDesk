import type { FormEvent, MouseEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { workspaceService } from '../services/workspaceService';
import type { Workspace } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ToastContainer, type Toast } from '../components/Toast';
import { useAuth } from '../hooks/useAuth';
import { idFromRef } from '../utils/idFromRef';

export function DashboardPage() {
  const { user } = useAuth();
  const [activeWorkspaces, setActiveWorkspaces] = useState<Workspace[]>([]);
  const [recentWorkspaces, setRecentWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [rejoiningId, setRejoiningId] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const navigate = useNavigate();

  const addToast = useCallback((message: string, variant: Toast['variant'] = 'default') => {
    const id = crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const toast: Toast = { id, message, variant };
    setToasts((prev) => [...prev, toast]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const reloadLists = useCallback(async () => {
    const data = await workspaceService.getMyWorkspaces();
    setActiveWorkspaces(data.activeWorkspaces);
    setRecentWorkspaces(data.recentWorkspaces);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await workspaceService.getMyWorkspaces();
        if (!cancelled) {
          setActiveWorkspaces(data.activeWorkspaces);
          setRecentWorkspaces(data.recentWorkspaces);
        }
      } catch {
        if (!cancelled) setError('Could not load workspaces.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedTitle = titleInput.trim();

    if (!trimmedTitle) {
      addToast('Workspace title is required.', 'error');
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { data: workspace } = await workspaceService.createWorkspace(trimmedTitle);
      if (!workspace?._id) {
        throw new Error('Invalid workspace response.');
      }

      setActiveWorkspaces((prev) => [
        workspace,
        ...prev.filter((ws) => String(ws._id) !== String(workspace._id)),
      ]);

      setTitleInput('');
      setError(null);
      addToast('Workspace created successfully.', 'success');
      navigate(`/workspace/${workspace._id}`);

      reloadLists().catch(console.error);
    } catch (err: unknown) {
      const ax = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      const message =
        ax.response?.data?.message ||
        (err instanceof Error ? err.message : undefined) ||
        'Failed to create workspace.';
      addToast(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleJoin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const id = (formData.get('workspaceId') as string) ?? '';
    if (!id.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const ws = await workspaceService.joinWorkspace(id.trim());
      await reloadLists();
      navigate(`/workspace/${ws._id}`);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Failed to join workspace.');
    } finally {
      setJoining(false);
    }
  };

  const handleRejoin = async (e: MouseEvent<HTMLButtonElement>, ws: Workspace) => {
    e.stopPropagation();
    setRejoiningId(ws._id);
    try {
      await workspaceService.joinWorkspace(ws._id);
      addToast('Rejoined workspace', 'success');
      await reloadLists();
      navigate(`/workspace/${ws._id}`);
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to rejoin workspace', 'error');
    } finally {
      setRejoiningId(null);
    }
  };

  const handleDeleteWorkspace = async (e: MouseEvent<HTMLButtonElement>, ws: Workspace) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Delete workspace "${ws.title}"? This cannot be undone and will remove all messages.`,
      )
    ) {
      return;
    }
    try {
      await workspaceService.deleteWorkspace(ws._id);
      await reloadLists();
      addToast('Workspace deleted', 'success');
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to delete workspace', 'error');
    }
  };

  const renderWorkspaceCard = (ws: Workspace, opts: { variant: 'active' | 'recent' }) => {
    const isCreator = user && idFromRef(ws.createdBy) === user.id;
    const isRecent = opts.variant === 'recent';

    return (
      <li
        key={ws._id}
        className={
          isRecent
            ? 'rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm'
            : 'group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm hover:border-sky-500/60 hover:bg-slate-900'
        }
        onClick={isRecent ? undefined : () => navigate(`/workspace/${ws._id}`)}
        onKeyDown={
          isRecent
            ? undefined
            : (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault();
                  navigate(`/workspace/${ws._id}`);
                }
              }
        }
        role={isRecent ? undefined : 'link'}
        tabIndex={isRecent ? undefined : 0}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-slate-100">{ws.title}</p>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                {isRecent && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                    Left
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isCreator
                      ? 'bg-sky-500/20 text-sky-200'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {isCreator ? 'Owner' : 'Member'}
                </span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">
                  {ws.members.length} active
                </span>
              </div>
            </div>
            {ws._id && (
              <p className="mt-1 truncate text-[10px] text-slate-500">
                ID: <span className="font-mono">{ws._id}</span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {isRecent && (
              <Button
                type="button"
                loading={rejoiningId === ws._id}
                onClick={(e) => handleRejoin(e, ws)}
                className="px-2 py-1 text-[10px]"
              >
                Rejoin
              </Button>
            )}
            {isCreator && (
              <button
                type="button"
                onClick={(e) => handleDeleteWorkspace(e, ws)}
                className="rounded-md border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-200 hover:bg-red-500/20"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </li>
    );
  };

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:py-10">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-50">Your workspaces</h2>
          <p className="text-sm text-slate-400">
            Active memberships and spaces you left (rejoin anytime). Only Delete removes a
            workspace permanently.
          </p>
        </div>
      </div>

      {error && !creating && !joining && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-medium text-slate-100">Create workspace</h3>
          <form onSubmit={handleCreate} className="space-y-3">
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              placeholder="Weekly planning, Sprint board..."
            />
            <Button type="submit" loading={creating} className="w-full">
              Create
            </Button>
          </form>
        </div>

        <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="text-sm font-medium text-slate-100">Join by ID</h3>
          <form onSubmit={handleJoin} className="space-y-3">
            <Input
              name="workspaceId"
              placeholder="Paste workspace ID"
              required
            />
            <Button type="submit" loading={joining} className="w-full">
              Join
            </Button>
          </form>
        </div>
      </div>

      <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-100">Active workspaces</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : activeWorkspaces.length === 0 ? (
          <p className="text-sm text-slate-500">No active workspaces. Create or join one above.</p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {activeWorkspaces.map((ws) => renderWorkspaceCard(ws, { variant: 'active' }))}
          </ul>
        )}
      </div>

      <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-100">Recently left workspaces</h3>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : recentWorkspaces.length === 0 ? (
          <p className="text-sm text-slate-500">
            When you leave a space, it appears here so you can rejoin without the ID if you
            change your mind.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {recentWorkspaces.map((ws) => renderWorkspaceCard(ws, { variant: 'recent' }))}
          </ul>
        )}
      </div>
    </div>
  );
}
