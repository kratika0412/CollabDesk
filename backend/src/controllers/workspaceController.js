const PDFDocument = require('pdfkit');
const Workspace = require('../models/Workspace');
const Message = require('../models/Message');
const httpError = require('../utils/httpError');

function assertActiveMember(workspace, userId) {
  const uid = userId.toString();
  if (!workspace.members.some((m) => m.toString() === uid)) {
    throw httpError(403, 'You are not a member of this workspace');
  }
}

async function createWorkspace(req, res) {
  try {
    console.log('Create workspace request:', req.body);
    const { title } = req.body;
    const trimmedTitle = typeof title === 'string' ? title.trim() : '';

    if (!trimmedTitle) {
      return res.status(400).json({
        message: 'Workspace title is required.',
      });
    }

    if (trimmedTitle.length > 140) {
      return res.status(400).json({
        message: 'Workspace title must be at most 140 characters.',
      });
    }

    const workspace = await Workspace.create({
      title: trimmedTitle,
      createdBy: req.user._id,
      members: [req.user._id],
      pastMembers: [],
      noteContent: '',
    });

    console.log('Created workspace:', workspace._id);

    const populatedWorkspace = await Workspace.findById(workspace._id)
      .populate('createdBy', 'name email')
      .populate('members', 'name email')
      .populate('pastMembers', 'name email')
      .lean();

    return res.status(201).json(populatedWorkspace);
  } catch (error) {
    console.error('Create workspace error:', error);
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : 'Failed to create workspace.';
    return res.status(500).json({
      message: msg || 'Failed to create workspace.',
    });
  }
}

async function joinWorkspace(req, res, next) {
  try {
    const { workspaceId } = req.body;
    if (!workspaceId) {
      throw httpError(400, 'workspaceId is required');
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }

    const isMember = workspace.members.some(
      (m) => m.toString() === req.user._id.toString()
    );
    if (!isMember) {
      workspace.members.push(req.user._id);
      await workspace.save();

      const io = req.app.get('io');
      if (io) {
        io.to(workspaceId).emit('workspaceUpdated', { workspaceId });
      }
    }

    res.json(workspace);
  } catch (err) {
    next(err);
  }
}

async function getMyWorkspaces(req, res, next) {
  try {
    const uid = req.user._id;
    const [activeWorkspaces, recentWorkspaces] = await Promise.all([
      Workspace.find({ members: uid }).sort({ createdAt: -1 }),
      Workspace.find({
        pastMembers: uid,
        members: { $nin: [uid] },
      }).sort({ updatedAt: -1 }),
    ]);

    res.json({ activeWorkspaces, recentWorkspaces });
  } catch (err) {
    next(err);
  }
}

async function getWorkspace(req, res, next) {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }
    assertActiveMember(workspace, req.user._id);
    res.json(workspace);
  } catch (err) {
    next(err);
  }
}

async function getNotes(req, res, next) {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }
    assertActiveMember(workspace, req.user._id);
    res.json({ content: workspace.noteContent || '' });
  } catch (err) {
    next(err);
  }
}

async function updateNotes(req, res, next) {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (content != null && typeof content !== 'string') {
      throw httpError(400, 'content must be a string');
    }

    const maxLength = 20000;
    if (typeof content === 'string' && content.length > maxLength) {
      throw httpError(413, 'Note content is too large');
    }

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }
    assertActiveMember(workspace, req.user._id);

    workspace.noteContent = content || '';
    await workspace.save();

    res.json({ content: workspace.noteContent });
  } catch (err) {
    next(err);
  }
}

async function getMessages(req, res, next) {
  try {
    const { id } = req.params;

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }
    assertActiveMember(workspace, req.user._id);

    const messages = await Message.find({ workspace: id })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'name email');

    res.json(
      messages.map((m) => ({
        id: m._id,
        content: m.content,
        senderName: m.sender.name,
        senderEmail: m.sender.email,
        senderId: m.sender._id,
        createdAt: m.createdAt,
      }))
    );
  } catch (err) {
    next(err);
  }
}

async function exportNotes(req, res, next) {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }
    assertActiveMember(workspace, req.user._id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${workspace.title.replace(/\s+/g, '_')}.pdf"`
    );

    const doc = new PDFDocument();
    doc.pipe(res);

    const timestamp = new Date().toISOString();

    doc.fontSize(20).text('SyncSpace Notes Export', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).text(`Workspace: ${workspace.title}`);
    doc.fontSize(12).text(`Exported at: ${timestamp}`);
    doc.moveDown();
    doc.fontSize(12).text('Notes:', { underline: true });
    doc.moveDown();

    doc.fontSize(12).text(workspace.noteContent || '');

    doc.end();
  } catch (err) {
    next(err);
  }
}

async function removeMember(req, res, next) {
  try {
    const { id, memberId } = req.params;
    if (!memberId) {
      throw httpError(400, 'memberId is required');
    }

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }

    assertActiveMember(workspace, req.user._id);

    if (workspace.createdBy.toString() !== req.user._id.toString()) {
      throw httpError(403, 'Only the workspace owner can remove members');
    }

    if (memberId === req.user._id.toString()) {
      throw httpError(400, 'You cannot remove yourself from the workspace');
    }

    const isMember = workspace.members.some(
      (m) => m.toString() === memberId,
    );
    if (!isMember) {
      throw httpError(404, 'Member is not part of this workspace');
    }

    workspace.members = workspace.members.filter(
      (m) => m.toString() !== memberId,
    );
    await workspace.save();

    const io = req.app.get('io');
    if (io) {
      const { kickMemberFromWorkspace } = require('../socket');
      await kickMemberFromWorkspace(io, id, memberId);
      io.to(id).emit('workspaceUpdated', { workspaceId: id });
    }

    res.json(workspace);
  } catch (err) {
    next(err);
  }
}

async function leaveWorkspace(req, res, next) {
  try {
    const { id } = req.params;
    const userId = req.user._id.toString();

    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }

    const isMember = workspace.members.some((m) => m.toString() === userId);
    if (!isMember) {
      throw httpError(403, 'You are not a member of this workspace');
    }

    const wasOwner = workspace.createdBy.toString() === userId;

    if (!workspace.pastMembers) {
      workspace.pastMembers = [];
    }
    const alreadyPast = workspace.pastMembers.some((m) => m.toString() === userId);
    if (!alreadyPast) {
      workspace.pastMembers.push(req.user._id);
    }

    workspace.members = workspace.members.filter((m) => m.toString() !== userId);

    if (wasOwner && workspace.members.length > 0) {
      workspace.createdBy = workspace.members[0];
    }

    await workspace.save();
    const fresh = await Workspace.findById(id);

    const io = req.app.get('io');
    if (io) {
      const { removeLeavingUserFromRoom } = require('../socket');
      await removeLeavingUserFromRoom(io, id, userId);
      if (wasOwner && fresh && fresh.members.length > 0) {
        io.to(id).emit('ownershipTransferred', {
          workspaceId: id,
          newOwnerId: fresh.createdBy.toString(),
        });
      }
      io.to(id).emit('workspaceUpdated', { workspaceId: id });
    }

    res.json({ workspace: fresh });
  } catch (err) {
    next(err);
  }
}

async function deleteWorkspace(req, res, next) {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      throw httpError(404, 'Workspace not found');
    }

    if (workspace.createdBy.toString() !== req.user._id.toString()) {
      throw httpError(403, 'Only the workspace owner can delete this workspace');
    }

    await Message.deleteMany({ workspace: id });
    await Workspace.findByIdAndDelete(id);

    const io = req.app.get('io');
    if (io) {
      const { notifyWorkspaceDeleted } = require('../socket');
      await notifyWorkspaceDeleted(io, id);
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createWorkspace,
  joinWorkspace,
  getMyWorkspaces,
  getWorkspace,
  getNotes,
  updateNotes,
  getMessages,
  exportNotes,
  removeMember,
  leaveWorkspace,
  deleteWorkspace,
};

