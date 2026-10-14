import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

// GET /users
router.get('/', requireAuth, (req, res) => {
  const { role, search, active, page = '1', per_page = '50' } = req.query;
  const p = parseInt(page as string, 10);
  const pp = parseInt(per_page as string, 10);
  const offset = (p - 1) * pp;

  let query = `
    SELECT u.id, u.email, u.full_name, u.phone, u.avatar_url, u.is_active, u.created_at,
           GROUP_CONCAT(r.name) as roles, fp.designation, fp.expertise_tags
    FROM users u
    LEFT JOIN user_roles ur ON u.id = ur.user_id
    LEFT JOIN roles r ON ur.role_id = r.id
    LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (active !== undefined) {
    query += ' AND u.is_active = ?';
    params.push(active === 'true' || active === '1' ? 1 : 0);
  }

  if (search) {
    query += ' AND (u.full_name LIKE ? OR u.email LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' GROUP BY u.id';

  if (role) {
    query += ' HAVING instr(GROUP_CONCAT(r.name), ?) > 0';
    params.push(role);
  }

  query += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
  params.push(pp, offset);

  const users = db.query(query, params).map(u => ({
    ...u,
    is_active: Boolean(u.is_active),
    roles: u.roles ? u.roles.split(',') : [],
    expertise_tags: u.expertise_tags ? JSON.parse(u.expertise_tags) : []
  }));

  const total = db.queryOne<{ count: number }>('SELECT count(*) as count FROM users')?.count || 0;

  return successResponse(res, users, {
    page: p,
    per_page: pp,
    total,
    total_pages: Math.ceil(total / pp)
  });
});

// POST /users
router.post('/', requireAuth, requireRoles('SUPER_ADMIN', 'FYP_COORDINATOR'), (req, res) => {
  const { email, full_name, phone, role_name, designation, expertise_tags } = req.body;
  if (!email || !full_name || !role_name) {
    return errorResponse(res, 'VAL_001', 'Email, full name, and role are required', null, 400);
  }

  const existing = db.queryOne('SELECT id FROM users WHERE email = ?', [email.trim().toLowerCase()]);
  if (existing) {
    return errorResponse(res, 'CONFLICT_001', 'User with this email already exists', null, 409);
  }

  const role = db.queryOne<{ id: number }>('SELECT id FROM roles WHERE name = ?', [role_name]);
  if (!role) {
    return errorResponse(res, 'VAL_001', `Invalid role name: ${role_name}`, null, 400);
  }

  const activeSession = db.queryOne<{ id: string }>('SELECT id FROM academic_sessions WHERE is_active = 1');
  const userId = uuidv4();
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('RsciPortal2026!', salt);

  db.transaction(() => {
    db.execute(`
      INSERT INTO users (id, email, password_hash, full_name, phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `, [userId, email.trim().toLowerCase(), passwordHash, full_name.trim(), phone || null]);

    db.execute(`
      INSERT INTO user_roles (id, user_id, role_id, session_id)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), userId, role.id, role_name === 'SUPER_ADMIN' ? null : activeSession?.id || null]);

    if (designation || expertise_tags) {
      db.execute(`
        INSERT INTO faculty_profiles (user_id, designation, expertise_tags, max_supervision_load)
        VALUES (?, ?, ?, 6)
      `, [userId, designation || 'Faculty', JSON.stringify(expertise_tags || [])]);
    }

    recordAudit(req.user!.id, 'CREATE_USER', 'user', userId, null, { email, full_name, role_name });
  });

  return successResponse(res, { id: userId, email, full_name, role_name }, {}, 201);
});

// POST /users/bulk-import (CSV bulk import)
router.post('/bulk-import', requireAuth, requireRoles('SUPER_ADMIN', 'FYP_COORDINATOR'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return errorResponse(res, 'FILE_001', 'CSV file is required for bulk import', null, 400);
  }

  try {
    const records = parse(req.file.buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }) as any[];

    const activeSession = db.queryOne<{ id: string }>('SELECT id FROM academic_sessions WHERE is_active = 1');
    const salt = bcrypt.genSaltSync(10);
    const defaultHash = bcrypt.hashSync('RsciPortal2026!', salt);

    let importedCount = 0;
    const errors: Array<{ row: number; email: string; error: string }> = [];

    db.transaction(() => {
      records.forEach((row, idx) => {
        const email = row.email ? row.email.trim().toLowerCase() : '';
        const fullName = row.full_name || row.display_name || row.name;
        const roleName = row.role || 'STUDENT';

        if (!email || !fullName) {
          errors.push({ row: idx + 1, email, error: 'Missing required fields (email or full_name)' });
          return;
        }

        const role = db.queryOne<{ id: number }>('SELECT id FROM roles WHERE name = ?', [roleName]);
        if (!role) {
          errors.push({ row: idx + 1, email, error: `Invalid role: ${roleName}` });
          return;
        }

        const existing = db.queryOne('SELECT id FROM users WHERE email = ?', [email]);
        if (existing) {
          errors.push({ row: idx + 1, email, error: 'Duplicate email already exists in system' });
          return;
        }

        const userId = uuidv4();
        db.execute(`
          INSERT INTO users (id, email, password_hash, full_name, phone, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `, [userId, email, defaultHash, fullName, row.phone || null]);

        db.execute(`
          INSERT INTO user_roles (id, user_id, role_id, session_id)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), userId, role.id, roleName === 'SUPER_ADMIN' ? null : activeSession?.id || null]);

        if (roleName === 'SUPERVISOR' || roleName === 'CO_SUPERVISOR' || roleName === 'INTERNAL_EVALUATOR') {
          db.execute(`
            INSERT INTO faculty_profiles (user_id, designation, expertise_tags, max_supervision_load)
            VALUES (?, ?, ?, 6)
          `, [userId, row.designation || 'Lecturer / Assistant Professor', JSON.stringify([])]);
        }

        importedCount++;
      });

      recordAudit(req.user!.id, 'BULK_IMPORT_USERS', 'users', null, null, {
        total_rows: records.length,
        imported: importedCount,
        errors_count: errors.length
      });
    });

    return successResponse(res, {
      total_rows: records.length,
      imported_count: importedCount,
      rejected_count: errors.length,
      errors
    });
  } catch (err: any) {
    return errorResponse(res, 'VAL_001', `Failed to parse CSV file: ${err.message}`, null, 400);
  }
});

// PATCH /users/:id/activate
router.patch('/:id/activate', requireAuth, requireRoles('SUPER_ADMIN', 'FYP_COORDINATOR'), (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  const user = db.queryOne('SELECT id, full_name FROM users WHERE id = ?', [id]);
  if (!user) {
    return errorResponse(res, 'NF_001', 'User not found', null, 404);
  }

  const activeInt = is_active ? 1 : 0;
  db.execute("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?", [activeInt, id]);
  recordAudit(req.user!.id, is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', 'user', id);

  return successResponse(res, { message: `User status updated to ${is_active ? 'Active' : 'Inactive'}` });
});

export default router;
