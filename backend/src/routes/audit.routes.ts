import { Router } from 'express';
import { db } from '../database/db';
import { successResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';

const router = Router();

// GET /audit-logs (SRS M15, TC-AU-01..06)
router.get('/', requireAuth, requireRoles('SUPER_ADMIN', 'FYP_COORDINATOR', 'HOD'), (req, res) => {
  const { entity_type, entity_id, actor_id, action, page = '1', per_page = '50' } = req.query;
  const p = parseInt(page as string, 10);
  const pp = parseInt(per_page as string, 10);
  const offset = (p - 1) * pp;

  let sql = `
    SELECT al.*, u.full_name as actor_name, u.email as actor_email
    FROM audit_logs al
    LEFT JOIN users u ON al.actor_id = u.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (entity_type) {
    sql += ' AND al.entity_type = ?';
    params.push(entity_type);
  }

  if (entity_id) {
    sql += ' AND al.entity_id = ?';
    params.push(entity_id);
  }

  if (actor_id) {
    sql += ' AND al.actor_id = ?';
    params.push(actor_id);
  }

  if (action) {
    sql += ' AND al.action = ?';
    params.push(action);
  }

  sql += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
  params.push(pp, offset);

  const logs = db.query(sql, params).map(l => ({
    ...l,
    old_values: l.old_values ? JSON.parse(l.old_values) : null,
    new_values: l.new_values ? JSON.parse(l.new_values) : null
  }));

  const total = db.queryOne<{ count: number }>('SELECT count(*) as count FROM audit_logs')?.count || 0;

  return successResponse(res, logs, {
    page: p,
    per_page: pp,
    total,
    total_pages: Math.ceil(total / pp)
  });
});

export default router;
