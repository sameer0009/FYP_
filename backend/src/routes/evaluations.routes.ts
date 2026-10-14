import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// GET /sessions/:id/evaluation-stages (E1 - E5)
router.get('/sessions/:id/evaluation-stages', (req, res) => {
  const { id } = req.params;
  const stages = db.query(`
    SELECT es.*,
      (SELECT r.id FROM rubrics r WHERE r.evaluation_stage_id = es.id AND r.is_active = 1 LIMIT 1) as active_rubric_id
    FROM evaluation_stages es
    WHERE es.session_id = ?
    ORDER BY es.sort_order ASC
  `, [id]);
  return successResponse(res, stages);
});

// GET /rubrics
router.get('/rubrics', (req, res) => {
  const { stage_id } = req.query;
  let sql = `
    SELECT r.*, es.code as stage_code, es.name as stage_name, es.weightage_percent as stage_weight
    FROM rubrics r
    JOIN evaluation_stages es ON r.evaluation_stage_id = es.id
    WHERE r.is_active = 1
  `;
  const params: any[] = [];
  if (stage_id) {
    sql += ' AND r.evaluation_stage_id = ?';
    params.push(stage_id);
  }

  const rubrics = db.query(sql, params).map(r => {
    const criteria = db.query('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order ASC', [r.id]);
    return {
      ...r,
      criteria
    };
  });

  return successResponse(res, rubrics);
});

// GET /rubrics/:id
router.get('/rubrics/:id', (req, res) => {
  const rubric = db.queryOne(`
    SELECT r.*, es.code as stage_code, es.name as stage_name, es.weightage_percent as stage_weight
    FROM rubrics r
    JOIN evaluation_stages es ON r.evaluation_stage_id = es.id
    WHERE r.id = ?
  `, [req.params.id]);

  if (!rubric) {
    return errorResponse(res, 'NF_001', 'Rubric not found', null, 404);
  }

  const criteria = db.query('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order ASC', [rubric.id]);
  return successResponse(res, {
    ...rubric,
    criteria
  });
});

// POST /evaluations (Schedule an evaluation)
router.post('/evaluations', requireAuth, requireRoles('FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { group_id, stage_id, scheduled_at, venue } = req.body;
  if (!group_id || !stage_id) {
    return errorResponse(res, 'VAL_001', 'Group ID and stage ID are required', null, 400);
  }

  const existing = db.queryOne('SELECT id FROM evaluations WHERE group_id = ? AND stage_id = ?', [group_id, stage_id]);
  if (existing) {
    return errorResponse(res, 'CONFLICT_001', 'An evaluation has already been created for this group and stage', null, 409);
  }

  const evalId = uuidv4();
  db.execute(`
    INSERT INTO evaluations (id, group_id, stage_id, scheduled_at, venue, status)
    VALUES (?, ?, ?, ?, ?, 'SCHEDULED')
  `, [evalId, group_id, stage_id, scheduled_at || null, venue || 'Main Auditorium']);

  recordAudit(req.user!.id, 'SCHEDULE_EVALUATION', 'evaluation', evalId, null, { group_id, stage_id, scheduled_at });
  return successResponse(res, { id: evalId, group_id, stage_id, status: 'SCHEDULED' }, {}, 201);
});

// GET /evaluations/:id
router.get('/evaluations/:id', requireAuth, (req, res) => {
  const evaluation = db.queryOne(`
    SELECT ev.*, pg.group_code, pg.title as group_title, pg.project_type_id,
           es.code as stage_code, es.name as stage_name, es.weightage_percent as stage_weight,
           pt.name as project_type_name
    FROM evaluations ev
    JOIN project_groups pg ON ev.group_id = pg.id
    JOIN evaluation_stages es ON ev.stage_id = es.id
    JOIN project_types pt ON pg.project_type_id = pt.id
    WHERE ev.id = ?
  `, [req.params.id]);

  if (!evaluation) {
    return errorResponse(res, 'NF_001', 'Evaluation not found', null, 404);
  }

  // Load assigned panel
  const panel = db.query(`
    SELECT ep.id as panel_assignment_id, ep.panel_role,
           u.id as user_id, u.full_name, u.email, fp.designation
    FROM evaluation_panels ep
    JOIN users u ON ep.evaluator_id = u.id
    LEFT JOIN faculty_profiles fp ON u.id = fp.user_id
    WHERE ep.evaluation_id = ?
  `, [evaluation.id]);

  // Load active rubric for this stage
  const rubric = db.queryOne('SELECT * FROM rubrics WHERE evaluation_stage_id = ? AND is_active = 1 LIMIT 1', [evaluation.stage_id]);
  const criteria = rubric ? db.query('SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order ASC', [rubric.id]) : [];

  return successResponse(res, {
    ...evaluation,
    panel,
    rubric: rubric ? { ...rubric, criteria } : null
  });
});

// POST /evaluations/:id/panels (Assign panel members)
router.post('/evaluations/:id/panels', requireAuth, requireRoles('FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id: evaluationId } = req.params;
  const { members } = req.body; // Array of { evaluator_id, panel_role }

  if (!Array.isArray(members) || members.length === 0) {
    return errorResponse(res, 'VAL_001', 'Panel members list is required', null, 400);
  }

  db.transaction(() => {
    for (const m of members) {
      const existing = db.queryOne('SELECT id FROM evaluation_panels WHERE evaluation_id = ? AND evaluator_id = ?', [evaluationId, m.evaluator_id]);
      if (existing) {
        db.execute('UPDATE evaluation_panels SET panel_role = ? WHERE id = ?', [m.panel_role, existing.id]);
      } else {
        db.execute(`
          INSERT INTO evaluation_panels (id, evaluation_id, evaluator_id, panel_role)
          VALUES (?, ?, ?, ?)
        `, [uuidv4(), evaluationId, m.evaluator_id, m.panel_role]);
      }
    }

    recordAudit(req.user!.id, 'ASSIGN_PANEL', 'evaluation', evaluationId, null, { panel_size: members.length });
  });

  return successResponse(res, { message: 'Evaluation panel members assigned successfully' });
});

// POST /evaluations/:id/scores (Evaluator submits scores)
router.post('/evaluations/:id/scores', requireAuth, requireRoles('INTERNAL_EVALUATOR', 'EXTERNAL_EXAMINER', 'SUPERVISOR', 'FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id: evaluationId } = req.params;
  const { criteria_scores, comments } = req.body;

  if (!Array.isArray(criteria_scores) || criteria_scores.length === 0) {
    return errorResponse(res, 'VAL_001', 'Criteria scores array is required', null, 400);
  }

  const evaluation = db.queryOne<{ id: string; status: string }>('SELECT id, status FROM evaluations WHERE id = ?', [evaluationId]);
  if (!evaluation) {
    return errorResponse(res, 'NF_001', 'Evaluation not found', null, 404);
  }

  if (evaluation.status === 'PUBLISHED') {
    return errorResponse(res, 'WF_001', 'Evaluation results have already been published and locked', null, 409);
  }

  // Validate bounds for each criterion
  for (const item of criteria_scores) {
    const crit = db.queryOne<{ id: string; max_marks: number; name: string }>('SELECT id, max_marks, name FROM rubric_criteria WHERE id = ?', [item.criterion_id]);
    if (!crit) {
      return errorResponse(res, 'SCORE_001', `Unknown criterion: ${item.criterion_id}`, null, 422);
    }
    const scoreVal = parseFloat(item.marks_obtained);
    if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > crit.max_marks) {
      return errorResponse(res, 'SCORE_001', `Score for '${crit.name}' must be between 0 and ${crit.max_marks}`, {
        criterion: crit.name,
        provided: item.marks_obtained,
        max_marks: crit.max_marks
      }, 422);
    }
  }

  db.transaction(() => {
    for (const item of criteria_scores) {
      const existing = db.queryOne('SELECT id FROM evaluation_scores WHERE evaluation_id = ? AND criterion_id = ? AND evaluator_id = ?',
        [evaluationId, item.criterion_id, req.user!.id]);

      if (existing) {
        db.execute(`
          UPDATE evaluation_scores
          SET marks_obtained = ?, comments = ?
          WHERE id = ?
        `, [item.marks_obtained, item.comments || null, existing.id]);
      } else {
        db.execute(`
          INSERT INTO evaluation_scores (id, evaluation_id, criterion_id, evaluator_id, marks_obtained, comments)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [uuidv4(), evaluationId, item.criterion_id, req.user!.id, item.marks_obtained, item.comments || null]);
      }
    }

    // Transition status to SCORED if not already MODERATED
    if (evaluation.status === 'SCHEDULED' || evaluation.status === 'IN_PROGRESS') {
      db.execute("UPDATE evaluations SET status = 'SCORED' WHERE id = ?", [evaluationId]);
    }

    recordAudit(req.user!.id, 'SUBMIT_EVALUATION_SCORE', 'evaluation', evaluationId, null, {
      evaluator_id: req.user!.id,
      criteria_count: criteria_scores.length
    });
  });

  return successResponse(res, { message: 'Evaluation scores saved successfully' });
});

// GET /evaluations/:id/score-summary (Mean aggregation & completeness)
router.get('/evaluations/:id/score-summary', requireAuth, (req, res) => {
  const { id: evaluationId } = req.params;

  const evaluation = db.queryOne<{ id: string; stage_id: string; status: string; group_id: string }>(
    'SELECT * FROM evaluations WHERE id = ?',
    [evaluationId]
  );
  if (!evaluation) {
    return errorResponse(res, 'NF_001', 'Evaluation not found', null, 404);
  }

  const panel = db.query('SELECT * FROM evaluation_panels WHERE evaluation_id = ?', [evaluationId]);
  const panelSize = panel.length;

  // Distinct evaluators who have submitted
  const submitters = db.query<{ evaluator_id: string }>(
    'SELECT DISTINCT evaluator_id FROM evaluation_scores WHERE evaluation_id = ?',
    [evaluationId]
  );
  const submittedCount = submitters.length;

  // Criterion summaries
  const rubric = db.queryOne<{ id: string }>('SELECT id FROM rubrics WHERE evaluation_stage_id = ? AND is_active = 1', [evaluation.stage_id]);
  const criteria = rubric ? db.query<{ id: string; name: string; max_marks: number; weightage: number }>(
    'SELECT * FROM rubric_criteria WHERE rubric_id = ? ORDER BY sort_order ASC',
    [rubric.id]
  ) : [];

  let rawTotalWeighted = 0;
  const criterionSummary = criteria.map(c => {
    const scores = db.query<{ marks_obtained: number }>('SELECT marks_obtained FROM evaluation_scores WHERE evaluation_id = ? AND criterion_id = ?', [evaluationId, c.id]);
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + s.marks_obtained, 0) / scores.length : 0;
    const weighted = c.max_marks > 0 ? (avg / c.max_marks) * c.weightage : 0;
    rawTotalWeighted += weighted;

    return {
      criterion_id: c.id,
      criterion_name: c.name,
      max_marks: c.max_marks,
      weightage: c.weightage,
      mean_points: Math.round(avg * 100) / 100,
      weighted_score: Math.round(weighted * 100) / 100
    };
  });

  const normalizedPercent = Math.round(rawTotalWeighted * 100) / 100;

  return successResponse(res, {
    evaluation_id: evaluationId,
    status: evaluation.status,
    panel_size: panelSize,
    submitted_sheets: submittedCount,
    aggregation_method: 'MEAN_NORMALIZED_PERCENT',
    raw_aggregate_percent: normalizedPercent,
    final_percent: normalizedPercent,
    criterion_summary: criterionSummary
  });
});

// PATCH /evaluations/:id/publish (Publish grades)
router.patch('/evaluations/:id/publish', requireAuth, requireRoles('FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN'), (req, res) => {
  const { id: evaluationId } = req.params;

  db.execute("UPDATE evaluations SET status = 'PUBLISHED' WHERE id = ?", [evaluationId]);
  recordAudit(req.user!.id, 'PUBLISH_EVALUATION_RESULT', 'evaluation', evaluationId);

  return successResponse(res, { message: 'Evaluation results officially published' });
});

// GET /groups/:id/results (Visible published results)
router.get('/groups/:id/results', requireAuth, (req, res) => {
  const { id: groupId } = req.params;

  // Only published evaluations are visible to students (SRS FR-EV-06, Test Plan TC-EV-05)
  let sql = `
    SELECT ev.id, ev.status, es.code as stage_code, es.name as stage_name, es.weightage_percent as stage_weight
    FROM evaluations ev
    JOIN evaluation_stages es ON ev.stage_id = es.id
    WHERE ev.group_id = ?
  `;

  if (req.user!.active_role === 'STUDENT') {
    sql += " AND ev.status = 'PUBLISHED'";
  }

  sql += ' ORDER BY es.sort_order ASC';

  const stagesResults = db.query(sql, [groupId]);
  return successResponse(res, stagesResults);
});

export default router;
