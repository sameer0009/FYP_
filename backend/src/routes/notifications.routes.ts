import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// GET /notifications
router.get('/notifications', requireAuth, (req, res) => {
  const notifications = db.query(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `, [req.user!.id]).map(n => ({
    ...n,
    is_read: Boolean(n.is_read)
  }));

  const unreadCount = db.queryOne<{ count: number }>(
    'SELECT count(*) as count FROM notifications WHERE user_id = ? AND is_read = 0',
    [req.user!.id]
  )?.count || 0;

  return successResponse(res, notifications, { unread_count: unreadCount });
});

// PATCH /notifications/:id/read
router.patch('/notifications/:id/read', requireAuth, (req, res) => {
  const { id } = req.params;
  db.execute('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [id, req.user!.id]);
  return successResponse(res, { message: 'Notification marked as read' });
});

// POST /notifications/read-all
router.post('/notifications/read-all', requireAuth, (req, res) => {
  db.execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user!.id]);
  return successResponse(res, { message: 'All notifications marked as read' });
});

// GET /announcements
router.get('/announcements', (req, res) => {
  const announcements = db.query(`
    SELECT a.*, u.full_name as publisher_name, asess.name as session_name
    FROM announcements a
    JOIN users u ON a.published_by = u.id
    LEFT JOIN academic_sessions asess ON a.session_id = asess.id
    ORDER BY a.published_at DESC
  `).map(a => ({
    ...a,
    audience_roles: JSON.parse(a.audience_roles || '[]')
  }));

  return successResponse(res, announcements);
});

// POST /announcements
router.post('/announcements', requireAuth, requireRoles('FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN'), (req, res) => {
  const { title, body, audience_roles, session_id } = req.body;
  if (!title || !body) {
    return errorResponse(res, 'VAL_001', 'Announcement title and body are required', null, 400);
  }

  const id = uuidv4();
  db.execute(`
    INSERT INTO announcements (id, session_id, title, body, audience_roles, published_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [id, session_id || null, title.trim(), body.trim(), JSON.stringify(audience_roles || []), req.user!.id]);

  recordAudit(req.user!.id, 'PUBLISH_ANNOUNCEMENT', 'announcement', id, null, { title });
  return successResponse(res, { id, title, body }, {}, 201);
});

export default router;
