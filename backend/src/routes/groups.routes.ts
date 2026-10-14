import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// Helper to generate next group code: FYP-F26-001
function generateNextGroupCode(sessionId: string): string {
  const count = db.queryOne<{ count: number }>(
    'SELECT count(*) as count FROM project_groups WHERE session_id = ?',
    [sessionId]
  )?.count || 0;
  const seq = String(count + 1).padStart(3, '0');
  return `FYP-F26-${seq}`;
}

// POST /groups
router.post('/', requireAuth, (req, res) => {
  const { title, project_type_id, session_id } = req.body;
  if (!title || !project_type_id) {
    return errorResponse(res, 'VAL_001', 'Group title and project type are required', null, 400);
  }

  // Determine active session
  let targetSessionId = session_id;
  if (!targetSessionId) {
    const active = db.queryOne<{ id: string }>('SELECT id FROM academic_sessions WHERE is_active = 1');
    if (!active) {
      return errorResponse(res, 'VAL_001', 'No active academic session found', null, 400);
    }
    targetSessionId = active.id;
  }

  // Verify project type
  const projectType = db.queryOne('SELECT id, name FROM project_types WHERE id = ?', [project_type_id]);
  if (!projectType) {
    return errorResponse(res, 'VAL_001', 'Invalid project type selected', null, 400);
  }

  // If student is creating, check if student is already in an active group for this session
  if (req.user!.active_role === 'STUDENT') {
    const existingMembership = db.queryOne(`
      SELECT gm.id 
      FROM group_memberships gm
      JOIN project_groups pg ON gm.group_id = pg.id
      WHERE gm.user_id = ? AND pg.session_id = ? AND pg.status != 'CANCELLED'
    `, [req.user!.id, targetSessionId]);

    if (existingMembership) {
      return errorResponse(res, 'CONFLICT_002', 'You are already registered in a project group for this academic session', null, 409);
    }
  }

  const groupId = uuidv4();
  const groupCode = generateNextGroupCode(targetSessionId);

  db.transaction(() => {
    // 1. Insert Project Group
    db.execute(`
      INSERT INTO project_groups (id, group_code, title, project_type_id, session_id, status)
      VALUES (?, ?, ?, ?, ?, 'FORMING')
    `, [groupId, groupCode, title.trim(), project_type_id, targetSessionId]);

    // 2. Add creator as LEADER
    db.execute(`
      INSERT INTO group_memberships (id, group_id, user_id, member_role)
      VALUES (?, ?, ?, 'LEADER')
    `, [uuidv4(), groupId, req.user!.id]);

    // 3. Create initial empty proposal record
    db.execute(`
      INSERT INTO proposals (id, group_id, title, abstract, problem_statement, objectives, scope, methodology, status, version)
      VALUES (?, ?, ?, '', '', '', '', '', 'DRAFT', 1)
    `, [uuidv4(), groupId, title.trim()]);

    recordAudit(req.user!.id, 'CREATE_GROUP', 'project_group', groupId, null, { group_code: groupCode, title });
  });

  return successResponse(res, {
    id: groupId,
    group_code: groupCode,
    title,
    project_type_id,
    status: 'FORMING'
  }, {}, 201);
});

// GET /groups
router.get('/', requireAuth, (req, res) => {
  const { session_id, type_id, status, search, supervisor_id } = req.query;

  let sql = `
    SELECT pg.id, pg.group_code, pg.title, pg.status, pg.created_at,
           pt.name as project_type_name, pt.code as project_type_code, pt.ai_policy,
           asess.name as session_name,
           (SELECT count(*) FROM group_memberships gm WHERE gm.group_id = pg.id) as members_count,
           (SELECT u.full_name FROM group_memberships gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = pg.id AND gm.member_role = 'LEADER' LIMIT 1) as leader_name,
           (SELECT u.full_name FROM supervision_allocations sa JOIN users u ON sa.supervisor_id = u.id WHERE sa.group_id = pg.id AND sa.status = 'ACTIVE' LIMIT 1) as supervisor_name,
           prop.status as proposal_status, prop.id as proposal_id
    FROM project_groups pg
    JOIN project_types pt ON pg.project_type_id = pt.id
    JOIN academic_sessions asess ON pg.session_id = asess.id
    LEFT JOIN proposals prop ON prop.group_id = pg.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (session_id) {
    sql += ' AND pg.session_id = ?';
    params.push(session_id);
  }

  if (type_id) {
    sql += ' AND pg.project_type_id = ?';
    params.push(type_id);
  }

  if (status) {
    sql += ' AND pg.status = ?';
    params.push(status);
  }

  if (search) {
    sql += ' AND (pg.title LIKE ? OR pg.group_code LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (supervisor_id) {
    sql += ' AND EXISTS (SELECT 1 FROM supervision_allocations sa WHERE sa.group_id = pg.id AND sa.supervisor_id = ? AND sa.status = "ACTIVE")';
    params.push(supervisor_id);
  }

  // Role scoping: if student, can see all groups or prioritize own
  if (req.user!.active_role === 'STUDENT') {
    // allowed to view
  }

  sql += ' ORDER BY pg.created_at DESC';

  const groups = db.query(sql, params);
  return successResponse(res, groups);
});

// GET /groups/:id
router.get('/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  const group = db.queryOne(`
    SELECT pg.*, pt.name as project_type_name, pt.code as project_type_code, pt.ai_policy, pt.ai_policy_notes,
           asess.name as session_name
    FROM project_groups pg
    JOIN project_types pt ON pg.project_type_id = pt.id
    JOIN academic_sessions asess ON pg.session_id = asess.id
    WHERE pg.id = ?
  `, [id]);

  if (!group) {
    return errorResponse(res, 'NF_001', 'Group not found', null, 404);
  }

  // Load members
  const members = db.query(`
    SELECT gm.id as membership_id, gm.member_role, gm.joined_at,
           u.id as user_id, u.full_name, u.email, u.phone
    FROM group_memberships gm
    JOIN users u ON gm.user_id = u.id
    WHERE gm.group_id = ?
    ORDER BY CASE WHEN gm.member_role = 'LEADER' THEN 1 ELSE 2 END, gm.joined_at ASC
  `, [id]);

  // Load proposal
  const proposal = db.queryOne('SELECT * FROM proposals WHERE group_id = ?', [id]);

  // Load active supervisor allocation
  const supervisor = db.queryOne(`
    SELECT sa.id as allocation_id, sa.alloc_role, sa.status, sa.allocated_at,
           u.id as user_id, u.full_name, u.email, fp.designation
    FROM supervision_allocations sa
    JOIN users u ON sa.supervisor_id = u.id
    LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE sa.group_id = ? AND sa.status = 'ACTIVE'
  `, [id]);

  return successResponse(res, {
    ...group,
    members,
    proposal,
    supervisor
  });
});

// POST /groups/:id/members
router.post('/:id/members', requireAuth, (req, res) => {
  const { id } = req.params;
  const { email } = req.body;

  if (!email) {
    return errorResponse(res, 'VAL_001', 'Student email is required', null, 400);
  }

  const group = db.queryOne<{ id: string; session_id: string; status: string }>('SELECT id, session_id, status FROM project_groups WHERE id = ?', [id]);
  if (!group) {
    return errorResponse(res, 'NF_001', 'Group not found', null, 404);
  }

  // Check group size limit (max 4 default per SRS 2.6 / M5)
  const currentMembers = db.queryOne<{ count: number }>('SELECT count(*) as count FROM group_memberships WHERE group_id = ?', [id])?.count || 0;
  if (currentMembers >= 4) {
    return errorResponse(res, 'CONFLICT_002', 'Group has reached maximum limit of 4 students', null, 409);
  }

  const targetUser = db.queryOne<{ id: string; full_name: string }>('SELECT id, full_name FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (!targetUser) {
    return errorResponse(res, 'NF_001', 'No student found with this email', null, 404);
  }

  // Check if target user already in an active group this session
  const alreadyInGroup = db.queryOne(`
    SELECT pg.group_code
    FROM group_memberships gm
    JOIN project_groups pg ON gm.group_id = pg.id
    WHERE gm.user_id = ? AND pg.session_id = ? AND pg.status != 'CANCELLED'
  `, [targetUser.id, group.session_id]);

  if (alreadyInGroup) {
    return errorResponse(res, 'CONFLICT_002', `Student is already enrolled in group ${alreadyInGroup.group_code}`, null, 409);
  }

  const membershipId = uuidv4();
  db.execute(`
    INSERT INTO group_memberships (id, group_id, user_id, member_role)
    VALUES (?, ?, ?, 'MEMBER')
  `, [membershipId, id, targetUser.id]);

  recordAudit(req.user!.id, 'ADD_GROUP_MEMBER', 'project_group', id, null, { added_user_id: targetUser.id });

  return successResponse(res, {
    message: `${targetUser.full_name} added to group successfully`,
    membership_id: membershipId
  }, {}, 201);
});

// POST /groups/:id/status
router.post('/:id/status', requireAuth, requireRoles('FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['FORMING', 'PROPOSED', 'APPROVED', 'IN_PROGRESS', 'EVALUATION', 'COMPLETED', 'ARCHIVED'];
  if (!validStatuses.includes(status)) {
    return errorResponse(res, 'VAL_001', `Invalid group status: ${status}`, null, 400);
  }

  db.execute("UPDATE project_groups SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, id]);
  recordAudit(req.user!.id, 'UPDATE_GROUP_STATUS', 'project_group', id, null, { new_status: status });

  return successResponse(res, { message: `Group status transitioned to ${status}` });
});

export default router;
