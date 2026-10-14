import { Router } from 'express';
import { stringify } from 'csv-stringify/sync';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';

const router = Router();

// GET /reports/groups-summary (JSON or CSV)
router.get('/groups-summary', requireAuth, requireRoles('FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN', 'SUPERVISOR'), (req, res) => {
  const { session_id, format } = req.query;

  let sql = `
    SELECT pg.group_code, pg.title, pg.status as group_status,
           pt.name as project_type, pt.ai_policy,
           asess.name as session_name,
           (SELECT u.full_name FROM group_memberships gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = pg.id AND gm.member_role = 'LEADER' LIMIT 1) as leader_name,
           (SELECT u.full_name FROM supervision_allocations sa JOIN users u ON sa.supervisor_id = u.id WHERE sa.group_id = pg.id AND sa.status = 'ACTIVE' LIMIT 1) as supervisor_name,
           (SELECT coalesce(sum(ee.hours), 0) FROM effort_entries ee WHERE ee.group_id = pg.id) as total_effort_hours,
           (SELECT p.status FROM proposals p WHERE p.group_id = pg.id) as proposal_status
    FROM project_groups pg
    JOIN project_types pt ON pg.project_type_id = pt.id
    JOIN academic_sessions asess ON pg.session_id = asess.id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (session_id) {
    sql += ' AND pg.session_id = ?';
    params.push(session_id);
  }

  sql += ' ORDER BY pg.group_code ASC';
  const rows = db.query(sql, params);

  if (format === 'csv') {
    const csvContent = stringify(rows, { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="rsci_groups_summary.csv"');
    return res.status(200).send(csvContent);
  }

  return successResponse(res, rows);
});

// GET /reports/at-risk-groups (SRS M14, TC-RP-01)
// Groups are flagged as at-risk if:
// 1. Total logged effort is below expected pro-rata timeline (or 0 hours)
// 2. Proposal is REJECTED or RESUBMISSION_REQUIRED
// 3. No supervisor allocated
router.get('/at-risk-groups', requireAuth, requireRoles('FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN', 'SUPERVISOR'), (req, res) => {
  const { session_id } = req.query;

  const groups = db.query(`
    SELECT pg.id, pg.group_code, pg.title, pg.status,
           pt.name as project_type_name,
           (SELECT u.full_name FROM supervision_allocations sa JOIN users u ON sa.supervisor_id = u.id WHERE sa.group_id = pg.id AND sa.status = 'ACTIVE' LIMIT 1) as supervisor_name,
           (SELECT p.status FROM proposals p WHERE p.group_id = pg.id) as proposal_status,
           (SELECT coalesce(sum(hours), 0) FROM effort_entries ee WHERE ee.group_id = pg.id) as total_hours
    FROM project_groups pg
    JOIN project_types pt ON pg.project_type_id = pt.id
    WHERE pg.status != 'COMPLETED' AND pg.status != 'ARCHIVED'
  `);

  const atRiskList = [];
  for (const g of groups) {
    const riskReasons: string[] = [];

    if (!g.supervisor_name) {
      riskReasons.push('UNASSIGNED_SUPERVISOR');
    }
    if (g.proposal_status === 'REJECTED' || g.proposal_status === 'RESUBMISSION_REQUIRED') {
      riskReasons.push(`PROPOSAL_${g.proposal_status}`);
    }
    if (g.total_hours < 18) {
      riskReasons.push('LOW_STUDENT_EFFORT_HOURS');
    }

    if (riskReasons.length > 0) {
      atRiskList.push({
        ...g,
        risk_flags: riskReasons,
        severity: riskReasons.length >= 2 ? 'HIGH' : 'MEDIUM'
      });
    }
  }

  return successResponse(res, atRiskList);
});

// GET /reports/supervisor-load
router.get('/supervisor-load', requireAuth, requireRoles('FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN'), (req, res) => {
  const faculty = db.query(`
    SELECT u.id, u.full_name, u.email,
           fp.designation, fp.max_supervision_load,
           (SELECT count(*) FROM supervision_allocations sa WHERE sa.supervisor_id = u.id AND sa.status = 'ACTIVE') as active_groups_count
    FROM users u
    JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE u.is_active = 1
    ORDER BY active_groups_count DESC, u.full_name ASC
  `).map(f => ({
    ...f,
    utilization_percent: Math.round((f.active_groups_count / f.max_supervision_load) * 100)
  }));

  return successResponse(res, faculty);
});

// GET /reports/evaluation-progress
router.get('/evaluation-progress', requireAuth, requireRoles('FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN'), (req, res) => {
  const stages = db.query(`
    SELECT es.id, es.code, es.name, es.weightage_percent,
           (SELECT count(*) FROM evaluations ev WHERE ev.stage_id = es.id) as total_evaluations,
           (SELECT count(*) FROM evaluations ev WHERE ev.stage_id = es.id AND ev.status IN ('SCORED', 'MODERATED', 'PUBLISHED')) as completed_evaluations,
           (SELECT count(*) FROM evaluations ev WHERE ev.stage_id = es.id AND ev.status = 'PUBLISHED') as published_evaluations
    FROM evaluation_stages es
    ORDER BY es.sort_order ASC
  `).map(s => ({
    ...s,
    progress_percent: s.total_evaluations > 0 ? Math.round((s.completed_evaluations / s.total_evaluations) * 100) : 0
  }));

  return successResponse(res, stages);
});

export default router;
