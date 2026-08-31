const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Workspace = require('../models/Workspace');
const User = require('../models/User');

// workspaceId -> Map<userId, { name, socketIds: Set<string> }>
const activeUsersByWorkspace = new Map();

function getActiveUsersList(workspaceId) {
  const map = activeUsersByWorkspace.get(workspaceId);
  if (!map) return [];
  return Array.from(map.entries()).map(([userId, value]) => ({
    userId,
    name: value.name,
  }));
}

function registerSocketHandlers(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Unauthorized'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_change_me');
      const user = await User.findById(decoded.id).select('name');
      if (!user) {
        return next(new Error('Unauthorized'));
      }

      socket.data.userId = user._id.toString();
      socket.data.name = user.name;
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.on('joinWorkspace', async ({ workspaceId }) => {
      const userId = socket.data.userId;
      const name = socket.data.name;
      if (!workspaceId || !userId) return;

      try {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return;

        const isMember = workspace.members.some(
          (m) => m.toString() === userId.toString(),
        );
        if (!isMember) {
          workspace.members.push(userId);
          await workspace.save();
        }

        socket.join(workspaceId);
        socket.data.workspaceId = workspaceId;

        let userMap = activeUsersByWorkspace.get(workspaceId);
        if (!userMap) {
          userMap = new Map();
          activeUsersByWorkspace.set(workspaceId, userMap);
        }

        const existing = userMap.get(userId) || { name, socketIds: new Set() };
        existing.name = name || existing.name;
        existing.socketIds.add(socket.id);
        userMap.set(userId, existing);

        io.to(workspaceId).emit('userConnected', {
          workspaceId,
          users: getActiveUsersList(workspaceId),
        });
      } catch (err) {
        console.error('Error in joinWorkspace socket handler', err);
      }
    });

    socket.on('leaveWorkspace', () => {
      const { workspaceId, userId } = socket.data;
      if (!workspaceId || !userId) return;

      socket.leave(workspaceId);

      const userMap = activeUsersByWorkspace.get(workspaceId);
      if (userMap) {
        const entry = userMap.get(userId);
        if (entry) {
          entry.socketIds.delete(socket.id);
          if (entry.socketIds.size === 0) {
            userMap.delete(userId);
          }
        }
        if (userMap.size === 0) {
          activeUsersByWorkspace.delete(workspaceId);
        }
      }

      io.to(workspaceId).emit('userDisconnected', {
        workspaceId,
        users: getActiveUsersList(workspaceId),
      });
    });

    socket.on('noteChange', ({ content }) => {
      const { workspaceId } = socket.data;
      if (!workspaceId) return;
      socket.to(workspaceId).emit('noteChange', { content });
    });

    socket.on('sendMessage', async ({ workspaceId, content }) => {
      const userId = socket.data.userId;
      const name = socket.data.name;
      const roomId = socket.data.workspaceId;

      if (!workspaceId || !userId || !content || workspaceId !== roomId) return;

      const trimmed = String(content).trim();
      if (!trimmed) return;
      if (trimmed.length > 2000) return;

      try {
        const message = await Message.create({
          workspace: workspaceId,
          sender: userId,
          content: trimmed,
        });

        io.to(workspaceId).emit('message', {
          id: message._id,
          content: message.content,
          senderId: userId,
          senderName: name,
          createdAt: message.createdAt,
        });
      } catch (err) {
        // For simplicity log and ignore; REST will still work
        console.error('Error saving message from socket:', err);
      }
    });

    socket.on('disconnect', () => {
      const { workspaceId, userId } = socket.data;
      if (!workspaceId || !userId) return;

      const userMap = activeUsersByWorkspace.get(workspaceId);
      if (userMap) {
        const entry = userMap.get(userId);
        if (entry) {
          entry.socketIds.delete(socket.id);
          if (entry.socketIds.size === 0) {
            userMap.delete(userId);
          }
        }
        if (userMap.size === 0) {
          activeUsersByWorkspace.delete(workspaceId);
        }
      }

      io.to(workspaceId).emit('userDisconnected', {
        workspaceId,
        users: getActiveUsersList(workspaceId),
      });
    });
  });
}

/**
 * Kick a member from the Socket.io room and update presence maps.
 * Emits removedFromWorkspace to the kicked sockets and userDisconnected to the room.
 */
async function kickMemberFromWorkspace(io, workspaceId, memberId) {
  const memberIdStr = String(memberId);
  const sockets = await io.in(workspaceId).fetchSockets();
  const matching = sockets.filter((s) => String(s.data.userId) === memberIdStr);

  matching.forEach((sock) => {
    sock.leave(workspaceId);
    sock.data.workspaceId = undefined;
    sock.emit('removedFromWorkspace', { workspaceId });
  });

  const userMap = activeUsersByWorkspace.get(workspaceId);
  if (userMap) {
    userMap.delete(memberIdStr);
    if (userMap.size === 0) {
      activeUsersByWorkspace.delete(workspaceId);
    }
  }

  io.to(workspaceId).emit('userDisconnected', {
    workspaceId,
    users: getActiveUsersList(workspaceId),
  });
}

/**
 * Notify all clients in a workspace room that it was deleted, then clear presence.
 */
async function notifyWorkspaceDeleted(io, workspaceId) {
  const sockets = await io.in(workspaceId).fetchSockets();
  sockets.forEach((sock) => {
    sock.leave(workspaceId);
    sock.data.workspaceId = undefined;
    sock.emit('workspaceDeleted', { workspaceId });
  });
  activeUsersByWorkspace.delete(workspaceId);
}

/**
 * Remove a user's sockets from a room and update presence (voluntary leave).
 * Does not emit removedFromWorkspace.
 */
async function removeLeavingUserFromRoom(io, workspaceId, userId) {
  const userIdStr = String(userId);
  const sockets = await io.in(workspaceId).fetchSockets();
  sockets
    .filter((s) => String(s.data.userId) === userIdStr)
    .forEach((sock) => {
      sock.leave(workspaceId);
      sock.data.workspaceId = undefined;
    });

  const userMap = activeUsersByWorkspace.get(workspaceId);
  if (userMap) {
    userMap.delete(userIdStr);
    if (userMap.size === 0) {
      activeUsersByWorkspace.delete(workspaceId);
    }
  }

  io.to(workspaceId).emit('userDisconnected', {
    workspaceId,
    users: getActiveUsersList(workspaceId),
  });
}

module.exports = registerSocketHandlers;
module.exports.kickMemberFromWorkspace = kickMemberFromWorkspace;
module.exports.notifyWorkspaceDeleted = notifyWorkspaceDeleted;
module.exports.removeLeavingUserFromRoom = removeLeavingUserFromRoom;

