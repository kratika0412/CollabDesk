const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/workspaceController');

const router = express.Router();

router.use(authMiddleware);

router.post('/', createWorkspace);
router.post('/join', joinWorkspace);
router.get('/', getMyWorkspaces);
router.post('/:id/leave', leaveWorkspace);
router.delete('/:id/members/:memberId', removeMember);
router.delete('/:id', deleteWorkspace);
router.get('/:id', getWorkspace);
router.get('/:id/notes', getNotes);
router.put('/:id/notes', updateNotes);
router.get('/:id/messages', getMessages);
router.get('/:id/export', exportNotes);

module.exports = router;

