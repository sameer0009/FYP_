import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// POST /groups/:id/meetings (Schedule meeting)
router.post('/groups/:id/meetings', requireAuth, (req, res) => {
  const { id: groupId } = req.params;
  const { title, scheduled_at, duration_minutes = 60, mode = 'IN_PERSON', venue_link, agenda } = req.body;

  if (!title || !scheduled_at) {
    return errorResponse(res, 'VAL_001', 'Meeting title and scheduled timestamp are required', null, 400);
  }

  const meetingId = uuidv4();
  db.execute(`
    INSERT INTO meetings (id, group_id, title, scheduled_at, duration_minutes, mode, venue_link, agenda, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)
  `, [meetingId, groupId, title.trim(), scheduled_at, duration_minutes, mode, venue_link || null, agenda || null, req.user!.id]);

  recordAudit(req.user!.id, 'SCHEDULE_MEETING', 'meeting', meetingId, null, { group_id: groupId, scheduled_at, title });
  return successResponse(res, { id: meetingId, group_id: groupId, title, scheduled_at, status: 'SCHEDULED' }, {}, 201);
});

// GET /groups/:id/meetings
router.get('/groups/:id/meetings', requireAuth, (req, res) => {
  const { id: groupId } = req.params;

  const meetings = db.query(`
    SELECT m.*, u.full_name as organizer_name,
           mm.notes as minutes_notes, mm.decisions as minutes_decisions,
           mm.supervisor_signed_off, mm.signed_off_at, mm.effort_hours_logged
    FROM meetings m
    JOIN users u ON m.created_by = u.id
    LEFT JOIN meeting_minutes mm ON m.id = mm.meeting_id
    WHERE m.group_id = ?
    ORDER BY m.scheduled_at DESC
  `, [groupId]);

  // Attach attendance and action items
  const fullMeetings = meetings.map(m => {
    const attendance = db.query(`
      SELECT ma.*, u.full_name, u.email
      FROM meeting_attendance ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id = ?
    `, [m.id]);

    const actions = db.query(`
      SELECT ai.*, u.full_name as owner_name
      FROM action_items ai
      JOIN users u ON ai.owner_id = u.id
      WHERE ai.meeting_id = ?
    `, [m.id]);

    return {
      ...m,
      attendance,
      actions
    };
  });

  return successResponse(res, fullMeetings);
});

// POST /meetings/:id/attendance
router.post('/meetings/:id/attendance', requireAuth, requireRoles('SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id: meetingId } = req.params;
  const { entries } = req.body; // Array of { user_id, attendance }

  if (!Array.isArray(entries)) {
    return errorResponse(res, 'VAL_001', 'Attendance entries must be an array', null, 400);
  }

  db.transaction(() => {
    for (const e of entries) {
      const existing = db.queryOne('SELECT id FROM meeting_attendance WHERE meeting_id = ? AND user_id = ?', [meetingId, e.user_id]);
      if (existing) {
        db.execute('UPDATE meeting_attendance SET attendance = ? WHERE id = ?', [e.attendance, existing.id]);
      } else {
        db.execute(`
          INSERT INTO meeting_attendance (id, meeting_id, user_id, attendance)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), meetingId, e.user_id, e.attendance]);
      }
    }
  });

  return successResponse(res, { message: 'Attendance recorded successfully' });
});

// POST /meetings/:id/minutes
router.post('/meetings/:id/minutes', requireAuth, (req, res) => {
  const { id: meetingId } = req.params;
  const { notes, decisions, effort_hours_logged = 0, action_items = [] } = req.body;

  if (!notes) {
    return errorResponse(res, 'VAL_001', 'Meeting notes / minutes text required', null, 400);
  }

  const existing = db.queryOne<{ id: string; supervisor_signed_off: number }>('SELECT id, supervisor_signed_off FROM meeting_minutes WHERE meeting_id = ?', [meetingId]);
  if (existing && existing.supervisor_signed_off === 1) {
    return errorResponse(res, 'WF_001', 'Minutes are already signed off and locked. Create an amendment or contact coordinator.', null, 409);
  }

  db.transaction(() => {
    if (existing) {
      db.execute(`
        UPDATE meeting_minutes
        SET notes = ?, decisions = ?, effort_hours_logged = ?
        WHERE id = ?
      `, [notes, decisions || null, effort_hours_logged, existing.id]);
    } else {
      db.execute(`
        INSERT INTO meeting_minutes (id, meeting_id, notes, decisions, supervisor_signed_off, effort_hours_logged)
        VALUES (?, ?, ?, ?, 0, ?)
      `, [uuidv4(), meetingId, notes, decisions || null, effort_hours_logged]);
    }

    // Update meeting status to COMPLETED
    db.execute("UPDATE meetings SET status = 'COMPLETED' WHERE id = ?", [meetingId]);

    // Insert action items
    if (Array.isArray(action_items)) {
      for (const item of action_items) {
        if (item.description && item.owner_id) {
          db.execute(`
            INSERT INTO action_items (id, meeting_id, description, owner_id, due_date, status)
            VALUES (?, ?, ?, ?, ?, 'OPEN')
          `, [uuidv4(), meetingId, item.description, item.owner_id, item.due_date || null]);
        }
      }
    }

    recordAudit(req.user!.id, 'SAVE_MINUTES', 'meeting', meetingId);
  });

  return successResponse(res, { message: 'Meeting minutes saved' });
});

// POST /meetings/:id/sign-off
router.post('/meetings/:id/sign-off', requireAuth, requireRoles('SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id: meetingId } = req.params;
  const minutes = db.queryOne<{ id: string }>('SELECT id FROM meeting_minutes WHERE meeting_id = ?', [meetingId]);
  if (!minutes) {
    return errorResponse(res, 'NF_001', 'No minutes recorded for this meeting yet', null, 404);
  }

  db.execute(`
    UPDATE meeting_minutes
    SET supervisor_signed_off = 1,
        signed_off_at = datetime('now')
    WHERE id = ?
  `, [minutes.id]);

  recordAudit(req.user!.id, 'SIGN_OFF_MINUTES', 'meeting', meetingId);
  return successResponse(res, { message: 'Meeting minutes signed off and locked' });
});

// ==================== EFFORT LOGBOOK (300h Target & 9h/week) ====================

// POST /groups/:id/effort-entries
router.post('/groups/:id/effort-entries', requireAuth, (req, res) => {
  const { id: groupId } = req.params;
  const { work_date, hours, category, description, evidence_url } = req.body;

  if (!work_date || !hours || !category || !description) {
    return errorResponse(res, 'VAL_001', 'Work date, hours, category, and description are required', null, 400);
  }

  const hoursNum = parseFloat(hours);
  if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
    return errorResponse(res, 'VAL_001', 'Hours must be a positive number up to 24', null, 400);
  }

  const entryId = uuidv4();
  db.execute(`
    INSERT INTO effort_entries (id, group_id, student_id, work_date, hours, category, description, evidence_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [entryId, groupId, req.user!.id, work_date, hoursNum, category, description.trim(), evidence_url || null]);

  recordAudit(req.user!.id, 'LOG_EFFORT', 'effort_entry', entryId, null, { hours: hoursNum, category, work_date });
  return successResponse(res, { id: entryId, hours: hoursNum, work_date, category }, {}, 201);
});

// PATCH /effort-entries/:id/verify
router.patch('/effort-entries/:id/verify', requireAuth, requireRoles('SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id } = req.params;
  const entry = db.queryOne('SELECT id, hours FROM effort_entries WHERE id = ?', [id]);
  if (!entry) {
    return errorResponse(res, 'NF_001', 'Effort entry not found', null, 404);
  }

  db.execute(`
    UPDATE effort_entries
    SET verified_by = ?,
        verified_at = datetime('now')
    WHERE id = ?
  `, [req.user!.id, id]);

  recordAudit(req.user!.id, 'VERIFY_EFFORT', 'effort_entry', id);
  return successResponse(res, { message: 'Student effort entry verified' });
});

// GET /groups/:id/effort-summary
router.get('/groups/:id/effort-summary', requireAuth, (req, res) => {
  const { id: groupId } = req.params;

  // 1. All effort entries for the group
  const entries = db.query(`
    SELECT ee.*, u.full_name as student_name, v.full_name as verifier_name
    FROM effort_entries ee
    JOIN users u ON ee.student_id = u.id
    LEFT JOIN users v ON ee.verified_by = v.id
    WHERE ee.group_id = ?
    ORDER BY ee.work_date DESC
  `, [groupId]);

  // 2. Aggregate hours
  const totalHours = entries.reduce((acc, curr) => acc + curr.hours, 0);
  const verifiedHours = entries.filter(e => e.verified_by !== null).reduce((acc, curr) => acc + curr.hours, 0);
  const targetHours = 300;
  const progressPercent = Math.min(100, Math.round((totalHours / targetHours) * 10000) / 100);

  // 3. Member breakdown
  const memberMap: { [studentId: string]: { student_id: string; student_name: string; total_hours: number; verified_hours: number } } = {};
  for (const e of entries) {
    if (!memberMap[e.student_id]) {
      memberMap[e.student_id] = {
        student_id: e.student_id,
        student_name: e.student_name,
        total_hours: 0,
        verified_hours: 0
      };
    }
    memberMap[e.student_id].total_hours += e.hours;
    if (e.verified_by) {
      memberMap[e.student_id].verified_hours += e.hours;
    }
  }

  // 4. Weekly trend (group by week)
  const weeklyTrend = db.query(`
    SELECT strftime('%Y-W%W', work_date) as week_code,
           min(work_date) as week_start,
           sum(hours) as weekly_hours
    FROM effort_entries
    WHERE group_id = ?
    GROUP BY strftime('%Y-W%W', work_date)
    ORDER BY week_code DESC
    LIMIT 8
  `, [groupId]);

  return successResponse(res, {
    group_id: groupId,
    target_hours: targetHours,
    total_hours: totalHours,
    verified_hours: verifiedHours,
    progress_percent: progressPercent,
    weekly_guideline_hours: 9,
    members: Object.values(memberMap),
    weekly_trend: weeklyTrend,
    entries
  });
});

export default router;
