import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { db } from '../database/db';
import { errorResponse } from '../utils/response';

export interface AuthenticatedUser {
  id: string;
  email: string;
  display_name: string;
  roles: string[];
  active_role: string;
  session_id: string | null;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const reqId = (req.headers['x-request-id'] as string) || `req_${uuidv4().substring(0, 8)}`;
  res.locals.requestId = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    if (!payload || !payload.id) {
      return next();
    }

    // Load active user and roles from DB
    const user = db.queryOne('SELECT id, email, full_name, is_active FROM users WHERE id = ?', [payload.id]);
    if (!user || user.is_active === 0) {
      return errorResponse(res, 'AUTH_004', 'User account is inactive or disabled', null, 403);
    }

    // Load user roles
    const userRoles = db.query<{ name: string; session_id: string | null }>(`
      SELECT r.name, ur.session_id
      FROM user_roles ur
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = ?
    `, [user.id]);

    const roleNames = userRoles.map(r => r.name);
    const activeRole = (req.headers['x-active-role'] as string) || payload.active_role || roleNames[0];

    // Load permissions for this active role
    const permissions = db.query<{ code: string }>(`
      SELECT p.code
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = ?
    `, [activeRole]).map(p => p.code);

    req.user = {
      id: user.id,
      email: user.email,
      display_name: user.full_name,
      roles: roleNames,
      active_role: activeRole,
      session_id: payload.session_id || null,
      permissions
    };

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'AUTH_002', 'Access token has expired', null, 401);
    }
    return errorResponse(res, 'AUTH_002', 'Invalid authentication token', null, 401);
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return errorResponse(res, 'AUTH_002', 'Authentication required for this endpoint', null, 401);
  }
  next();
}

export function requireRoles(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return errorResponse(res, 'AUTH_002', 'Authentication required', null, 401);
    }
    if (!allowedRoles.includes(req.user.active_role) && !req.user.roles.includes('SUPER_ADMIN')) {
      return errorResponse(
        res,
        'RBAC_001',
        `Access denied. Role ${req.user.active_role} is not authorized for this resource`,
        { allowed_roles: allowedRoles, current_role: req.user.active_role },
        403
      );
    }
    next();
  };
}
