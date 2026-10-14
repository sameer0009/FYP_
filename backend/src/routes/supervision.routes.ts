import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// GET /faculty
router.get('/faculty', requireAuth, (req, res) => {
  const faculty = db.query(`
    SELECT u.id, u.full_name, u.email, u.phone,
           fp.designation, fp.expertise_tags, fp.max_supervision_load,
           (SELECT count(*) FROM supervision_allocations sa WHERE sa.supervisor_id = u.id AND sa.status = 'ACTIVE') as current_load
    FROM users u
    JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE u.is_active = 1
    ORDER BY u.full_name ASC
  `).map(f => ({
    ...f,
    expertise_tags: JSON.parse(f.expertise_tags || '[]'),
    available_capacity: Math.max(0, f.max_supervision_load - f.current_load)
  }));

  return successResponse(res, faculty);
});

// POST /allocations
router.post('/allocations', requireAuth, requireRoles('FYP_COORDINATOR', 'SUPER_ADMIN', 'HOD'), (req, res) => {
  const { group_id, supervisor_id, alloc_role = 'SUPERVISOR' } = req.body;
  if (!group_id || !supervisor_id) {
    return errorResponse(res, 'VAL_001', 'Group ID and supervisor ID are required', null, 400);
  }

  // Check group existence
  const group = db.queryOne<{ id: string; group_code: string }>('SELECT id, group_code FROM project_groups WHERE id = ?', [group_id]);
  if (!group) {
    return errorResponse(res, 'NF_001', 'Group not found', null, 404);
  }

  // Check supervisor capacity
  const faculty = db.queryOne<{ full_name: string; max_supervision_load: number }>(`
    SELECT u.full_name, fp.max_supervision_load
    FROM users u
    JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE u.id = ?
  `, [supervisor_id]);

  if (!faculty) {
    return errorResponse(res, 'NF_001', 'Faculty member not found', null, 404);
  }

  const currentLoad = db.queryOne<{ count: number }>(`
    SELECT count(*) as count 
    FROM supervision_allocations 
    WHERE supervisor_id = ? AND status = 'ACTIVE'
  `, [supervisor_id])?.count || 0;

  if (currentLoad >= faculty.max_supervision_load) {
    return errorResponse(res, 'CONFLICT_002', `Cannot allocate: ${faculty.full_name} has reached maximum supervision capacity (${faculty.max_supervision_load} groups)`, {
      current_load: currentLoad,
      max_load: faculty.max_supervision_load
    }, 409);
  }

  // Check if group already has an active primary supervisor
  if (alloc_role === 'SUPERVISOR') {
    const existingSupervisor = db.queryOne(`
      SELECT sa.id, u.full_name
      FROM supervision_allocations sa
      JOIN users u ON sa.supervisor_id = u.id
      WHERE sa.group_id = ? AND sa.alloc_role = 'SUPERVISOR' AND sa.status = 'ACTIVE'
    `, [group_id]);

    if (existingSupervisor) {
      return errorResponse(res, 'CONFLICT_001', `Group already has active supervisor: ${existingSupervisor.full_name}. Please reassign instead.`, null, 409);
    }
  }

  const allocId = uuidv4();
  db.execute(`
    INSERT INTO supervision_allocations (id, group_id, supervisor_id, alloc_role, status)
    VALUES (?, ?, ?, ?, 'ACTIVE')
  `, [allocId, group_id, supervisor_id, alloc_role]);

  recordAudit(req.user!.id, 'ALLOCATE_SUPERVISOR', 'supervision_allocation', allocId, null, {
    group_id,
    supervisor_id,
    alloc_role
  });

  return successResponse(res, {
    id: allocId,
    group_id,
    supervisor_id,
    alloc_role,
    status: 'ACTIVE'
  }, {}, 201);
});

// GET /allocations
router.get('/allocations', requireAuth, (req, res) => {
  const { session_id, supervisor_id, status = 'ACTIVE' } = req.query;

  let sql = `
    SELECT sa.*, pg.group_code, pg.title as group_title,
           u.full_name as supervisor_name, u.email as supervisor_email,
           fp.designation
    FROM supervision_allocations sa
    JOIN project_groups pg ON sa.group_id = pg.id
    JOIN users u ON sa.supervisor_id = u.id
    LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND sa.status = ?';
    params.push(status);
  }

  if (supervisor_id) {
    sql += ' AND sa.supervisor_id = ?';
    params.push(supervisor_id);
  }

  if (session_id) {
    sql += ' AND pg.session_id = ?';
    params.push(session_id);
  }

  sql += ' ORDER BY sa.allocated_at DESC';

  const allocations = db.query(sql, params);
  return successResponse(res, allocations);
});

// PATCH /allocations/:id (Reassign)
router.patch('/allocations/:id', requireAuth, requireRoles('FYP_COORDINATOR', 'SUPER_ADMIN', 'HOD'), (req, res) => {
  const { id } = req.params;
  const { new_supervisor_id, reason } = req.body;

  if (!new_supervisor_id || !reason) {
    return errorResponse(res, 'VAL_001', 'New supervisor ID and reason for reassignment are required', null, 400);
  }

  const oldAlloc = db.queryOne<{ id: string; group_id: string; supervisor_id: string; alloc_role: string }>(
    'SELECT * FROM supervision_allocations WHERE id = ?',
    [id]
  );

  if (!oldAlloc) {
    return errorResponse(res, 'NF_001', 'Allocation record not found', null, 404);
  }

  const newAllocId = uuidv4();
  db.transaction(() => {
    // End old allocation
    db.execute("UPDATE supervision_allocations SET status = 'REASSIGNED' WHERE id = ?", [id]);

    // Insert new allocation
    db.execute(`
      INSERT INTO supervision_allocations (id, group_id, supervisor_id, alloc_role, status)
      VALUES (?, ?, ?, ?, 'ACTIVE')
    `, [newAllocId, oldAlloc.group_id, new_supervisor_id, oldAlloc.alloc_role]);

    recordAudit(req.user!.id, 'REASSIGN_SUPERVISOR', 'supervision_allocation', newAllocId, { previous_alloc_id: id, previous_supervisor: oldAlloc.supervisor_id }, { new_supervisor_id, reason });
  });

  return successResponse(res, {
    message: 'Supervisor reassigned successfully',
    new_allocation_id: newAllocId
  });
});

export default router;
