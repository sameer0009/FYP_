import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// POST /auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return errorResponse(res, 'VAL_001', 'Email and password are required', null, 400);
  }

  const user = db.queryOne<{ id: string; email: string; password_hash: string; full_name: string; is_active: number }>(
    'SELECT id, email, password_hash, full_name, is_active FROM users WHERE email = ?',
    [email.trim().toLowerCase()]
  );

  if (!user) {
    return errorResponse(res, 'AUTH_001', 'Invalid institutional credentials', null, 401);
  }

  if (user.is_active === 0) {
    return errorResponse(res, 'AUTH_004', 'Account is deactivated. Contact FYP Coordinator', null, 403);
  }

  const passwordValid = bcrypt.compareSync(password, user.password_hash);
  if (!passwordValid) {
    recordAudit(user.id, 'LOGIN_FAILED', 'user', user.id, null, { reason: 'Incorrect password' });
    return errorResponse(res, 'AUTH_001', 'Invalid institutional credentials', null, 401);
  }

  // Load user roles and session scopes
  const userRoles = db.query<{ name: string; session_id: string | null }>(`
    SELECT r.name, ur.session_id
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = ?
  `, [user.id]);

  const roles = userRoles.map(r => r.name);
  const sessionIds = Array.from(new Set(userRoles.map(r => r.session_id).filter(Boolean)));
  const defaultRole = roles[0] || 'STUDENT';
  const activeSessionId = sessionIds[0] || null;

  // Generate short-lived JWT access token
  const tokenPayload = {
    id: user.id,
    email: user.email,
    display_name: user.full_name,
    roles,
    active_role: defaultRole,
    session_id: activeSessionId
  };

  const accessToken = jwt.sign(tokenPayload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
  const refreshToken = jwt.sign({ id: user.id, tokenId: uuidv4() }, config.refreshTokenSecret, {
    expiresIn: config.refreshTokenExpiresIn
  });

  // Update last login
  db.execute("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", [user.id]);
  recordAudit(user.id, 'LOGIN_SUCCESS', 'user', user.id);

  return successResponse(res, {
    token_type: 'Bearer',
    access_token: accessToken,
    expires_in: config.jwtExpiresIn,
    refresh_token: refreshToken,
    refresh_expires_in: config.refreshTokenExpiresIn,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.full_name,
      roles,
      active_role: defaultRole,
      scopes: {
        session_ids: sessionIds,
        program_ids: ['CS', 'SE', 'IT', 'AI', 'DS', 'CY', 'CGV']
      }
    }
  });
});

// GET /auth/me
router.get('/me', requireAuth, (req, res) => {
  return successResponse(res, {
    id: req.user!.id,
    email: req.user!.email,
    display_name: req.user!.display_name,
    roles: req.user!.roles,
    active_role: req.user!.active_role,
    session_id: req.user!.session_id,
    permissions: req.user!.permissions
  });
});

// POST /auth/password-change
router.post('/password-change', requireAuth, (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return errorResponse(res, 'VAL_001', 'Current and new password required', null, 400);
  }

  if (new_password.length < 8) {
    return errorResponse(res, 'VAL_001', 'Password must be at least 8 characters long', null, 400);
  }

  const user = db.queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [req.user!.id]);
  if (!user || !bcrypt.compareSync(current_password, user.password_hash)) {
    return errorResponse(res, 'AUTH_001', 'Current password is incorrect', null, 400);
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(new_password, salt);
  db.execute("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [newHash, req.user!.id]);
  recordAudit(req.user!.id, 'PASSWORD_CHANGED', 'user', req.user!.id);

  return successResponse(res, { message: 'Password updated successfully' });
});

// POST /auth/logout
router.post('/logout', requireAuth, (req, res) => {
  recordAudit(req.user!.id, 'LOGOUT', 'user', req.user!.id);
  return successResponse(res, { message: 'Logged out successfully' });
});

export default router;
