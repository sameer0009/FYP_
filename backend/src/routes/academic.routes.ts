import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// ==================== SESSIONS & PROGRAMS ====================

// GET /sessions
router.get('/sessions', (req, res) => {
  const sessions = db.query(`
    SELECT s.*, 
      (SELECT count(*) FROM session_programs sp WHERE sp.session_id = s.id) as programs_count,
      (SELECT count(*) FROM project_groups pg WHERE pg.session_id = s.id) as groups_count
    FROM academic_sessions s
    ORDER BY s.start_date DESC
  `);
  return successResponse(res, sessions);
});

// POST /sessions
router.post('/sessions', requireAuth, requireRoles('SUPER_ADMIN', 'FYP_COORDINATOR'), (req, res) => {
  const { name, start_date, end_date } = req.body;
  if (!name || !start_date || !end_date) {
    return errorResponse(res, 'VAL_001', 'Name, start_date, and end_date are required', null, 400);
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return errorResponse(res, 'VAL_001', 'End date must be later than start date', null, 400);
  }

  const existing = db.queryOne('SELECT id FROM academic_sessions WHERE name = ?', [name.trim()]);
  if (existing) {
    return errorResponse(res, 'CONFLICT_001', 'An academic session with this name already exists', null, 409);
  }

  const id = uuidv4();
  db.execute(`
    INSERT INTO academic_sessions (id, name, start_date, end_date, is_active)
    VALUES (?, ?, ?, ?, 0)
  `, [id, name.trim(), start_date, end_date]);

  recordAudit(req.user!.id, 'CREATE_SESSION', 'academic_session', id, null, { name, start_date, end_date });
  return successResponse(res, { id, name, start_date, end_date, is_active: 0 }, {}, 201);
});

// POST /sessions/:id/activate (Ensures exactly ONE session is active)
router.post('/sessions/:id/activate', requireAuth, requireRoles('SUPER_ADMIN', 'FYP_COORDINATOR'), (req, res) => {
  const { id } = req.params;
  const session = db.queryOne('SELECT * FROM academic_sessions WHERE id = ?', [id]);
  if (!session) {
    return errorResponse(res, 'NF_001', 'Academic session not found', null, 404);
  }

  db.transaction(() => {
    // Deactivate all others
    db.execute('UPDATE academic_sessions SET is_active = 0');
    // Activate target
    db.execute('UPDATE academic_sessions SET is_active = 1 WHERE id = ?', [id]);
    recordAudit(req.user!.id, 'ACTIVATE_SESSION', 'academic_session', id);
  });

  return successResponse(res, { message: `Session ${session.name} is now the active academic term` });
});

// GET /programs
router.get('/programs', (req, res) => {
  const programs = db.query('SELECT * FROM programs ORDER BY code ASC');
  return successResponse(res, programs);
});

// GET /sessions/:id/calendar
router.get('/sessions/:id/calendar', (req, res) => {
  const { id } = req.params;
  const milestones = db.query(`
    SELECT m.*, pt.name as project_type_name
    FROM milestones m
    LEFT JOIN project_types pt ON m.project_type_id = pt.id
    WHERE m.session_id = ?
    ORDER BY m.due_date ASC, m.sort_order ASC
  `, [id]);
  return successResponse(res, milestones);
});

// ==================== PROJECT-TYPE CATALOGUE (10 Types) ====================

// GET /project-types
router.get('/project-types', (req, res) => {
  const types = db.query('SELECT * FROM project_types WHERE is_active = 1 ORDER BY name ASC');
  const parsed = types.map(t => ({
    ...t,
    suitable_programs: JSON.parse(t.suitable_programs || '[]')
  }));
  return successResponse(res, parsed);
});

// GET /project-types/:id
router.get('/project-types/:id', (req, res) => {
  const type = db.queryOne('SELECT * FROM project_types WHERE id = ?', [req.params.id]);
  if (!type) {
    return errorResponse(res, 'NF_001', 'Project type not found', null, 404);
  }
  return successResponse(res, {
    ...type,
    suitable_programs: JSON.parse(type.suitable_programs || '[]')
  });
});

export default router;
