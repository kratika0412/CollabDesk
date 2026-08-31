import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { workspaceService } from '../services/workspaceService';
import { noteService } from '../services/noteService';
import { chatService } from '../services/chatService';
import {
  ActiveUsers,
} from '../components/ActiveUsers';
import { NotesEditor } from '../components/NotesEditor';
import { ChatPanel } from '../components/ChatPanel';
import { Button } from '../components/ui/Button';
import { ToastContainer, type Toast } from '../components/Toast';
import type { ActiveUser, ChatMessage, Workspace } from '../types';
import { useAuth } from '../hooks/useAuth';
import {
  connectSocket,
  disconnectSocket,
  joinWorkspace,
  emitLeaveWorkspaceSocket,
  sendMessage,
  sendNoteChange,
  getSocket,
  subscribeToMessages,
  subscribeToNoteChange,
  subscribeToUsers,
  subscribeWorkspaceEvents,
} from '../services/socket';
import { useDebouncedCallback } from '../hooks/useDebouncedCallback';
import { idFromRef } from '../utils/idFromRef';

export function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [notes, setNotes] = useState('');
  const [remoteUpdating, setRemoteUpdating] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  /** When leaving voluntarily and the workspace is deleted (last member), skip duplicate `workspaceDeleted` toast. */
  const suppressWorkspaceDeletedToastRef = useRef(false);

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

  useEffect(() => {
    if (!workspaceId) return;
    suppressWorkspaceDeletedToastRef.current = false;
    let cancelled = false;

    async function load() {
      try {
        const id = workspaceId!;
        const [ws, noteContent, chat] = await Promise.all([
          workspaceService.getWorkspace(id),
          noteService.getNotes(id),
          chatService.getMessages(id),
        ]);
        if (cancelled) return;
        setWorkspace(ws);
        setNotes(noteContent);
        setMessages(chat);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.response?.data?.message ?? 'Failed to load workspace.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      suppressWorkspaceDeletedToastRef.current = false;
    };
  }, [workspaceId]);

  useEffect(() => {
    if (!workspaceId || !user) return;

    const token = localStorage.getItem('syncspace_token') ?? '';
    const socket = connectSocket(token);

    const id = workspaceId!;
    joinWorkspace(id);

    const unsubWorkspace = subscribeWorkspaceEvents({
      onRemovedFromWorkspace: (wid) => {
        if (wid !== id) return;
        emitLeaveWorkspaceSocket();
        addToast('You were removed from this workspace', 'error');
        navigate('/dashboard');
      },
      onWorkspaceDeleted: (wid) => {
        if (wid !== id) return;
        emitLeaveWorkspaceSocket();
        if (!suppressWorkspaceDeletedToastRef.current) {
          addToast('This workspace was deleted', 'error');
        } else {
          suppressWorkspaceDeletedToastRef.current = false;
        }
        navigate('/dashboard');
      },
      onOwnershipTransferred: (payload) => {
        if (payload.workspaceId !== id) return;
        if (payload.newOwnerId === user?.id) {
          addToast('You are now the workspace owner', 'success');
        } else {
          addToast('Workspace ownership was transferred', 'default');
        }
      },
      onWorkspaceUpdated: (wid) => {
        if (wid !== id) return;
        workspaceService
          .getWorkspace(id)
          .then(setWorkspace)
          .catch(() => {
            addToast('Could not refresh workspace details', 'error');
          });
      },
    });

    subscribeToNoteChange((content) => {
      setRemoteUpdating(true);
      setNotes(content);
      window.setTimeout(() => setRemoteUpdating(false), 150);
    });

    subscribeToMessages((message) => {
      setMessages((prev) => [...prev, message]);
    });

    subscribeToUsers((users) => {
      setActiveUsers((prev) => {
        const joined = users.filter(
          (u) => !prev.some((p) => p.userId === u.userId),
        );
        const left = prev.filter(
          (p) => !users.some((u) => u.userId === p.userId),
        );

        joined.forEach((u) => {
          if (u.userId !== user.id) {
            addToast(`🔵 ${u.name} joined the workspace`);
          }
        });

        left.forEach((u) => {
          if (u.userId !== user.id) {
            addToast(`⚪ ${u.name} left the workspace`);
          }
        });

        return users;
      });
    });

    return () => {
      unsubWorkspace();
      emitLeaveWorkspaceSocket();
      socket.off('noteChange');
      socket.off('message');
      socket.off('userConnected');
      socket.off('userDisconnected');
      disconnectSocket();
    };
  }, [workspaceId, user, addToast, navigate]);

  const persistNotes = useDebouncedCallback(async (content: string) => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      await noteService.updateNotes(workspaceId, content);
    } catch (err) {
      // Log and keep UI responsive; socket keeps peers in sync.
      // eslint-disable-next-line no-console
      console.error('Failed to persist notes', err);
    } finally {
      setSaving(false);
    }
  }, 700);

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (!workspaceId || !user) return;
    sendNoteChange(workspaceId, value);
    persistNotes(value);
  };

  const handleSendMessage = (content: string) => {
    if (!workspaceId || !user) return;
    const sock = getSocket();
    if (!sock?.connected) {
      addToast('Not connected. Check your network and try again.', 'error');
      return;
    }
    sendMessage(workspaceId, user.id, content, user.name);
  };

  const handleExport = async () => {
    if (!workspaceId) return;
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const token = localStorage.getItem('syncspace_token') ?? '';

    try {
      const res = await fetch(`${apiBase}/api/workspaces/${workspaceId}/export`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) {
        throw new Error('Failed to export notes');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${workspace?.title || 'notes'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      addToast('Notes exported as PDF', 'success');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Export failed', err);
      addToast('Failed to export notes', 'error');
    }
  };

  const handleLeave = async () => {
    if (!workspaceId) return;
    if (
      !window.confirm(
        'Leave this workspace? You will be removed from active members; the space stays available and you can rejoin from the dashboard.',
      )
    ) {
      return;
    }
    try {
      await workspaceService.leaveWorkspace(workspaceId);
      emitLeaveWorkspaceSocket();
      addToast('You left the workspace', 'success');
      navigate('/dashboard');
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to leave workspace', 'error');
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!workspaceId) return;
    if (
      !window.confirm(
        'Permanently delete this workspace? All members will be removed and all chat messages will be deleted.',
      )
    ) {
      return;
    }
    suppressWorkspaceDeletedToastRef.current = true;
    try {
      await workspaceService.deleteWorkspace(workspaceId);
      addToast('Workspace deleted', 'success');
      emitLeaveWorkspaceSocket();
      navigate('/dashboard');
    } catch (err: any) {
      suppressWorkspaceDeletedToastRef.current = false;
      addToast(err?.response?.data?.message ?? 'Failed to delete workspace', 'error');
    }
  };

  const handleRemoveMember = async (memberId: string, name: string) => {
    if (!workspaceId) return;
    if (!window.confirm(`Remove ${name} from this workspace?`)) return;
    try {
      await workspaceService.removeMember(workspaceId, memberId);
      addToast('Member removed', 'success');
      const ws = await workspaceService.getWorkspace(workspaceId);
      setWorkspace(ws);
    } catch (err: any) {
      addToast(err?.response?.data?.message ?? 'Failed to remove member', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-96px)] items-center justify-center">
        <p className="text-sm text-slate-400">Loading workspace...</p>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex min-h-[calc(100vh-96px)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-red-300">{error ?? 'Workspace not found.'}</p>
        <Button onClick={() => navigate('/dashboard')}>Back to dashboard</Button>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:py-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">{workspace.title}</h2>
          <p className="text-xs text-slate-500">
            Share this workspace ID to invite others:{' '}
            <span className="font-mono text-slate-300">{workspace._id}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleExport}
            className="border border-sky-500/60 bg-sky-600 px-4 py-1.5 text-xs text-slate-50 hover:bg-sky-500"
          >
            Export notes PDF
          </Button>
          <Button
            type="button"
            onClick={handleLeave}
            className="border border-slate-600 bg-slate-800 px-4 py-1.5 text-xs text-slate-50 hover:bg-slate-700"
          >
            Leave workspace
          </Button>
          {idFromRef(workspace.createdBy) === user!.id && (
            <Button
              type="button"
              onClick={handleDeleteWorkspace}
              className="border border-red-500/50 bg-red-600/90 px-4 py-1.5 text-xs text-slate-50 hover:bg-red-500"
            >
              Delete workspace
            </Button>
          )}
          {saving && (
            <span className="text-xs text-slate-500">Saving changes...</span>
          )}
          {!saving && remoteUpdating && (
            <span className="text-xs text-slate-500">Updated from collaborator</span>
          )}
        </div>
      </div>

      <div className="grid flex-1 gap-4 md:grid-cols-[220px_minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <div className="space-y-3">
          <ActiveUsers
            users={activeUsers}
            currentUserId={user!.id}
            createdById={idFromRef(workspace.createdBy)}
            onRemoveMember={
              idFromRef(workspace.createdBy) === user!.id ? handleRemoveMember : undefined
            }
          />
        </div>
        <div className="flex min-h-[320px] flex-col">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
            <span>Notes</span>
            <span className="text-[10px]">
              Autosaves every 700ms • Real-time for everyone in this space
            </span>
          </div>
          <div className="flex-1">
            <NotesEditor
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Capture decisions, ideas, and action items here..."
            />
          </div>
        </div>
        <div className="min-h-[280px]">
          <ChatPanel messages={messages} onSend={handleSendMessage} />
        </div>
      </div>
      </div>

    </>
  );
}

