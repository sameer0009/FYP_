import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

export function recordAudit(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  oldValues: any = null,
  newValues: any = null,
  ipAddress: string = '127.0.0.1'
) {
  try {
    const id = uuidv4();
    const oldStr = oldValues ? JSON.stringify(oldValues) : null;
    const newStr = newValues ? JSON.stringify(newValues) : null;

    db.execute(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, old_values, new_values, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, [id, actorId, action, entityType, entityId, oldStr, newStr, ipAddress]);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
