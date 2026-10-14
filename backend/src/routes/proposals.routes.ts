import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// GET /proposals/:id
router.get('/:id', requireAuth, (req, res) => {
  const proposal = db.queryOne(`
    SELECT p.*, pg.group_code, pg.title as group_title, pg.project_type_id,
           pt.name as project_type_name, pt.ai_policy, pt.ai_policy_notes
    FROM proposals p
    JOIN project_groups pg ON p.group_id = pg.id
    JOIN project_types pt ON pg.project_type_id = pt.id
    WHERE p.id = ?
  `, [req.params.id]);

  if (!proposal) {
    return errorResponse(res, 'NF_001', 'Proposal not found', null, 404);
  }

  // Load reviews
  const reviews = db.query(`
    SELECT pr.*, u.full_name as reviewer_name, u.email as reviewer_email
    FROM proposal_reviews pr
    JOIN users u ON pr.reviewer_id = u.id
    WHERE pr.proposal_id = ?
    ORDER BY pr.created_at DESC
  `, [proposal.id]);

  return successResponse(res, {
    ...proposal,
    reviews
  });
});

// PATCH /proposals/:id
router.patch('/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const proposal = db.queryOne<{ id: string; status: string; group_id: string; version: number }>('SELECT * FROM proposals WHERE id = ?', [id]);
  if (!proposal) {
    return errorResponse(res, 'NF_001', 'Proposal not found', null, 404);
  }

  // Check state: editable in DRAFT or RESUBMISSION_REQUIRED
  const editableStates = ['DRAFT', 'RESUBMISSION_REQUIRED'];
  if (!editableStates.includes(proposal.status) && req.user!.active_role !== 'SUPER_ADMIN') {
    return errorResponse(res, 'WF_001', `Cannot edit proposal while in state ${proposal.status}`, {
      current_state: proposal.status,
      allowed_states: editableStates
    }, 409);
  }

  const { title, abstract, problem_statement, objectives, scope, methodology, tools, timeline_text, document_url } = req.body;

  db.execute(`
    UPDATE proposals
    SET title = COALESCE(?, title),
        abstract = COALESCE(?, abstract),
        problem_statement = COALESCE(?, problem_statement),
        objectives = COALESCE(?, objectives),
        scope = COALESCE(?, scope),
        methodology = COALESCE(?, methodology),
        tools = COALESCE(?, tools),
        timeline_text = COALESCE(?, timeline_text),
        document_url = COALESCE(?, document_url),
        updated_at = datetime('now')
    WHERE id = ?
  `, [title, abstract, problem_statement, objectives, scope, methodology, tools, timeline_text, document_url, id]);

  recordAudit(req.user!.id, 'EDIT_PROPOSAL', 'proposal', id, null, { version: proposal.version });
  return successResponse(res, { message: 'Proposal draft updated successfully' });
});

// POST /proposals/:id/submit
router.post('/:id/submit', requireAuth, (req, res) => {
  const { id } = req.params;
  const proposal = db.queryOne<{ id: string; status: string; group_id: string; version: number; title: string }>('SELECT * FROM proposals WHERE id = ?', [id]);
  if (!proposal) {
    return errorResponse(res, 'NF_001', 'Proposal not found', null, 404);
  }

  if (proposal.status !== 'DRAFT' && proposal.status !== 'RESUBMISSION_REQUIRED') {
    return errorResponse(res, 'WF_001', `Proposal is already in state ${proposal.status}`, null, 409);
  }

  const nextVersion = proposal.status === 'RESUBMISSION_REQUIRED' ? proposal.version + 1 : proposal.version;

  db.transaction(() => {
    db.execute(`
      UPDATE proposals
      SET status = 'UNDER_SUPERVISOR_REVIEW',
          version = ?,
          submitted_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `, [nextVersion, id]);

    // Update group status to PROPOSED
    db.execute(`
      UPDATE project_groups
      SET status = 'PROPOSED',
          updated_at = datetime('now')
      WHERE id = ?
    `, [proposal.group_id]);

    recordAudit(req.user!.id, 'SUBMIT_PROPOSAL', 'proposal', id, { previous_status: proposal.status }, { new_status: 'UNDER_SUPERVISOR_REVIEW', version: nextVersion });
  });

  return successResponse(res, {
    message: 'Proposal submitted for academic review',
    status: 'UNDER_SUPERVISOR_REVIEW',
    version: nextVersion
  });
});

// POST /proposals/:id/reviews
router.post('/:id/reviews', requireAuth, requireRoles('SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'HOD', 'SUPER_ADMIN'), (req, res) => {
  const { id } = req.params;
  const { decision, comments, stage } = req.body;

  if (!decision || !comments) {
    return errorResponse(res, 'VAL_001', 'Review decision and feedback comments are required', null, 400);
  }

  const proposal = db.queryOne<{ id: string; status: string; group_id: string; version: number }>('SELECT * FROM proposals WHERE id = ?', [id]);
  if (!proposal) {
    return errorResponse(res, 'NF_001', 'Proposal not found', null, 404);
  }

  // Determine stage and resulting status
  const currentStage = stage || (req.user!.active_role === 'FYP_COORDINATOR' ? 'COORDINATOR' : 'SUPERVISOR');
  let newProposalStatus: string;
  let newGroupStatus: string | null = null;

  if (decision === 'APPROVED') {
    if (currentStage === 'SUPERVISOR') {
      newProposalStatus = 'UNDER_COORDINATOR_REVIEW';
    } else {
      newProposalStatus = 'APPROVED';
      newGroupStatus = 'APPROVED';
    }
  } else if (decision === 'RESUBMISSION_REQUIRED') {
    newProposalStatus = 'RESUBMISSION_REQUIRED';
  } else if (decision === 'REJECTED') {
    newProposalStatus = 'REJECTED';
    newGroupStatus = 'CANCELLED';
  } else {
    newProposalStatus = proposal.status;
  }

  const reviewId = uuidv4();
  db.transaction(() => {
    db.execute(`
      INSERT INTO proposal_reviews (id, proposal_id, reviewer_id, stage, decision, comments)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [reviewId, id, req.user!.id, currentStage, decision, comments.trim()]);

    db.execute(`
      UPDATE proposals
      SET status = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `, [newProposalStatus, id]);

    if (newGroupStatus) {
      db.execute(`
        UPDATE project_groups
        SET status = ?,
            updated_at = datetime('now')
        WHERE id = ?
      `, [newGroupStatus, proposal.group_id]);
    }

    recordAudit(req.user!.id, 'REVIEW_PROPOSAL', 'proposal', id, null, {
      decision,
      stage: currentStage,
      derived_status: newProposalStatus
    });
  });

  return successResponse(res, {
    review_id: reviewId,
    decision,
    proposal_status: newProposalStatus,
    group_status: newGroupStatus
  }, {}, 201);
});

// GET /proposals (Review queue)
router.get('/', requireAuth, (req, res) => {
  const { status, session_id } = req.query;

  let sql = `
    SELECT p.id, p.title, p.status, p.version, p.submitted_at, p.updated_at,
           pg.id as group_id, pg.group_code, pg.title as group_title,
           pt.name as project_type_name, pt.code as project_type_code,
           (SELECT u.full_name FROM group_memberships gm JOIN users u ON gm.user_id = u.id WHERE gm.group_id = pg.id AND gm.member_role = 'LEADER' LIMIT 1) as leader_name
    FROM proposals p
    JOIN project_groups pg ON p.group_id = pg.id
    JOIN project_types pt ON pg.project_type_id = pt.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (status) {
    sql += ' AND p.status = ?';
    params.push(status);
  }

  if (session_id) {
    sql += ' AND pg.session_id = ?';
    params.push(session_id);
  }

  sql += ' ORDER BY p.updated_at DESC';

  const list = db.query(sql, params);
  return successResponse(res, list);
});

export default router;
