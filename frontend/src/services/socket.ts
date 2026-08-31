import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';
import type { ActiveUser, ChatMessage } from '../types';

type NoteChangeHandler = (content: string) => void;
type MessageHandler = (message: ChatMessage) => void;
type UsersHandler = (users: ActiveUser[]) => void;

let socket: Socket | null = null;

export function connectSocket(token: string) {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket'],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function joinWorkspace(workspaceId: string) {
  if (!socket) return;
  socket.emit('joinWorkspace', { workspaceId });
}

/** Emit socket `leaveWorkspace` (presence + room leave). Use after HTTP leave/delete or on page unload. */
export function emitLeaveWorkspaceSocket() {
  if (!socket) return;
  socket.emit('leaveWorkspace');
}

export function sendNoteChange(workspaceId: string, content: string) {
  if (!socket) return;
  socket.emit('noteChange', { workspaceId, content });
}

export function sendMessage(workspaceId: string, userId: string, content: string, name: string) {
  if (!socket) return;
  socket.emit('sendMessage', { workspaceId, userId, content, name });
}

export function subscribeToNoteChange(handler: NoteChangeHandler) {
  if (!socket) return;
  socket.off('noteChange');
  socket.on('noteChange', ({ content }) => {
    handler(content);
  });
}

export function subscribeToMessages(handler: MessageHandler) {
  if (!socket) return;
  socket.off('message');
  socket.on('message', (payload) => {
    handler({
      id: payload.id,
      content: payload.content,
      senderId: payload.senderId,
      senderName: payload.senderName,
      createdAt: payload.createdAt,
    });
  });
}

export function subscribeToUsers(handler: UsersHandler) {
  if (!socket) return;
  const update = (payload: { users: ActiveUser[] }) => handler(payload.users);
  socket.off('userConnected');
  socket.off('userDisconnected');
  socket.on('userConnected', update);
  socket.on('userDisconnected', update);
}

export type OwnershipTransferredPayload = {
  workspaceId: string;
  newOwnerId: string;
};

export type WorkspaceEventHandlers = {
  onRemovedFromWorkspace: (workspaceId: string) => void;
  onWorkspaceDeleted: (workspaceId: string) => void;
  onOwnershipTransferred?: (payload: OwnershipTransferredPayload) => void;
  onWorkspaceUpdated?: (workspaceId: string) => void;
};

/** Register workspace lifecycle listeners; call returned function to remove them. */
export function subscribeWorkspaceEvents(handlers: WorkspaceEventHandlers): () => void {
  if (!socket) {
    return () => {};
  }

  const onRemoved = (payload: { workspaceId: string }) => {
    handlers.onRemovedFromWorkspace(payload.workspaceId);
  };
  const onDeleted = (payload: { workspaceId: string }) => {
    handlers.onWorkspaceDeleted(payload.workspaceId);
  };
  const onOwner = (payload: OwnershipTransferredPayload) => {
    handlers.onOwnershipTransferred?.(payload);
  };
  const onUpdated = (payload: { workspaceId: string }) => {
    handlers.onWorkspaceUpdated?.(payload.workspaceId);
  };

  socket.on('removedFromWorkspace', onRemoved);
  socket.on('workspaceDeleted', onDeleted);
  socket.on('ownershipTransferred', onOwner);
  socket.on('workspaceUpdated', onUpdated);

  return () => {
    socket?.off('removedFromWorkspace', onRemoved);
    socket?.off('workspaceDeleted', onDeleted);
    socket?.off('ownershipTransferred', onOwner);
    socket?.off('workspaceUpdated', onUpdated);
  };
}

