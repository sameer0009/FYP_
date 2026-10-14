import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from '../database/db';
import { config } from '../config';
import { successResponse, errorResponse } from '../utils/response';
import { requireAuth, requireRoles } from '../middleware/auth';
import { recordAudit } from '../utils/audit';

const router = Router();

// Configure multer storage for deliverables
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `deliv_${Date.now()}_${uuidv4().substring(0, 8)}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit (NFR-PE-03)
});

// GET /groups/:id/deliverable-checklist
router.get('/groups/:id/deliverable-checklist', requireAuth, (req, res) => {
  const { id: groupId } = req.params;

  const group = db.queryOne<{ id: string; project_type_id: string; session_id: string }>(
    'SELECT id, project_type_id, session_id FROM project_groups WHERE id = ?',
    [groupId]
  );
  if (!group) {
    return errorResponse(res, 'NF_001', 'Group not found', null, 404);
  }

  // Get templates applicable to this project type or common (NULL project_type_id)
  const templates = db.query(`
    SELECT dt.*, m.title as milestone_title, m.due_date as milestone_due_date, m.sort_order as milestone_order,
           (SELECT count(*) FROM deliverable_submissions ds WHERE ds.group_id = ? AND ds.template_id = dt.id) as submission_count,
           (SELECT ds.status FROM deliverable_submissions ds WHERE ds.group_id = ? AND ds.template_id = dt.id ORDER BY ds.version DESC LIMIT 1) as latest_status,
           (SELECT ds.id FROM deliverable_submissions ds WHERE ds.group_id = ? AND ds.template_id = dt.id ORDER BY ds.version DESC LIMIT 1) as latest_submission_id
    FROM deliverable_templates dt
    JOIN milestones m ON dt.milestone_id = m.id
    WHERE m.session_id = ? AND (dt.project_type_id IS NULL OR dt.project_type_id = ?)
    ORDER BY m.sort_order ASC, dt.title ASC
  `, [groupId, groupId, groupId, group.session_id, group.project_type_id]);

  return successResponse(res, templates);
});

// POST /groups/:id/submissions (Deliverable Upload + AI Declaration)
router.post('/groups/:id/submissions', requireAuth, upload.single('file'), (req, res) => {
  const { id: groupId } = req.params;
  const {
    template_id,
    notes,
    ai_usage_level = 'NONE',
    tools_used,
    declaration_text = 'No generative AI assistance was used in this document.'
  } = req.body;

  if (!template_id || !req.file) {
    return errorResponse(res, 'VAL_001', 'Template ID and file are required', null, 400);
  }

  // Verify group and template
  const group = db.queryOne<{ id: string; project_type_id: string; group_code: string }>(
    'SELECT id, project_type_id, group_code FROM project_groups WHERE id = ?',
    [groupId]
  );
  if (!group) {
    return errorResponse(res, 'NF_001', 'Group not found', null, 404);
  }

  const projectType = db.queryOne<{ id: string; code: string; ai_policy: string; name: string }>(
    'SELECT id, code, ai_policy, name FROM project_types WHERE id = ?',
    [group.project_type_id]
  );

  // Compute file SHA-256
  const fileBuffer = fs.readFileSync(req.file.path);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  const sha256Hex = hashSum.digest('hex');

  // Determine next submission version
  const lastSub = db.queryOne<{ version: number }>(
    'SELECT version FROM deliverable_submissions WHERE group_id = ? AND template_id = ? ORDER BY version DESC LIMIT 1',
    [groupId, template_id]
  );
  const nextVersion = lastSub ? lastSub.version + 1 : 1;

  // Evaluate AI Usage Policy Match (M11 & Appendix A)
  let policyFlag = 0;
  let policyNotes = 'Compliant with project type AI guidelines';

  if (projectType) {
    if (projectType.ai_policy === 'NO_AI' && ai_usage_level === 'EXTENSIVE') {
      policyFlag = 1;
      policyNotes = `Policy Mismatch: ${projectType.name} strictly prohibits extensive AI assistance in core deliverables.`;
    } else if (projectType.ai_policy === 'LIMITED' && ai_usage_level === 'EXTENSIVE') {
      policyFlag = 1;
      policyNotes = `Policy Alert: ${projectType.name} allows only limited AI. Extensive usage flagged for review.`;
    }
  }

  const submissionId = uuidv4();
  const declarationId = uuidv4();
  const fileUrl = `/uploads/${req.file.filename}`;

  db.transaction(() => {
    // 1. Insert Submission
    db.execute(`
      INSERT INTO deliverable_submissions (id, group_id, template_id, version, file_url, file_name, file_size_bytes, checksum_sha256, notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')
    `, [submissionId, groupId, template_id, nextVersion, fileUrl, req.file!.originalname, req.file!.size, sha256Hex, notes || null]);

    // 2. Insert AI Declaration
    db.execute(`
      INSERT INTO ai_declarations (id, submission_id, version, ai_usage_level, tools_used, declaration_text, declared_by, supervisor_attested, policy_flag, policy_notes)
      VALUES (?, ?, 1, ?, ?, ?, ?, 0, ?, ?)
    `, [declarationId, submissionId, ai_usage_level, tools_used || '[]', declaration_text, req.user!.id, policyFlag, policyNotes]);

    recordAudit(req.user!.id, 'SUBMIT_DELIVERABLE', 'deliverable_submission', submissionId, null, {
      template_id,
      version: nextVersion,
      checksum: sha256Hex,
      ai_policy_flag: policyFlag
    });
  });

  return successResponse(res, {
    submission_id: submissionId,
    version: nextVersion,
    file_name: req.file.originalname,
    checksum_sha256: sha256Hex,
    status: 'SUBMITTED',
    ai_declaration: {
      id: declarationId,
      ai_usage_level,
      policy_flag: Boolean(policyFlag),
      policy_notes: policyNotes
    }
  }, {}, 201);
});

// GET /groups/:id/submissions
router.get('/groups/:id/submissions', requireAuth, (req, res) => {
  const { id: groupId } = req.params;

  const submissions = db.query(`
    SELECT ds.*, dt.title as deliverable_title, m.title as milestone_title, m.due_date as milestone_due_date,
           aid.id as ai_declaration_id, aid.ai_usage_level, aid.tools_used, aid.declaration_text,
           aid.policy_flag, aid.policy_notes, aid.supervisor_attested
    FROM deliverable_submissions ds
    JOIN deliverable_templates dt ON ds.template_id = dt.id
    LEFT JOIN milestones m ON dt.milestone_id = m.id
    LEFT JOIN ai_declarations aid ON ds.id = aid.submission_id
    WHERE ds.group_id = ?
    ORDER BY ds.submitted_at DESC
  `, [groupId]);

  const parsed = submissions.map(s => ({
    ...s,
    policy_flag: Boolean(s.policy_flag),
    supervisor_attested: Boolean(s.supervisor_attested),
    tools_used: s.tools_used ? JSON.parse(s.tools_used) : []
  }));

  return successResponse(res, parsed);
});

// PATCH /submissions/:id/review (Supervisor Review)
router.patch('/submissions/:id/review', requireAuth, requireRoles('SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id } = req.params;
  const { decision, comments } = req.body;

  if (!decision || !comments) {
    return errorResponse(res, 'VAL_001', 'Review decision and comments are required', null, 400);
  }

  const submission = db.queryOne<{ id: string; group_id: string; status: string }>('SELECT id, group_id, status FROM deliverable_submissions WHERE id = ?', [id]);
  if (!submission) {
    return errorResponse(res, 'NF_001', 'Submission not found', null, 404);
  }

  const reviewId = uuidv4();
  db.transaction(() => {
    db.execute(`
      INSERT INTO submission_reviews (id, submission_id, reviewer_id, decision, comments)
      VALUES (?, ?, ?, ?, ?)
    `, [reviewId, id, req.user!.id, decision, comments.trim()]);

    db.execute(`
      UPDATE deliverable_submissions
      SET status = ?
      WHERE id = ?
    `, [decision, id]);

    recordAudit(req.user!.id, 'REVIEW_DELIVERABLE', 'deliverable_submission', id, null, { decision, comments });
  });

  return successResponse(res, { message: `Deliverable marked as ${decision}`, review_id: reviewId });
});

// PATCH /ai-declarations/:id/attest (Supervisor Attestation)
router.patch('/ai-declarations/:id/attest', requireAuth, requireRoles('SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'SUPER_ADMIN'), (req, res) => {
  const { id } = req.params;
  const decl = db.queryOne('SELECT id FROM ai_declarations WHERE id = ?', [id]);
  if (!decl) {
    return errorResponse(res, 'NF_001', 'AI Declaration not found', null, 404);
  }

  db.execute('UPDATE ai_declarations SET supervisor_attested = 1 WHERE id = ?', [id]);
  recordAudit(req.user!.id, 'ATTEST_AI_DECLARATION', 'ai_declaration', id);

  return successResponse(res, { message: 'AI declaration attested by supervisor' });
});

export default router;
