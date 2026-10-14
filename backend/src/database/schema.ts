import { db } from './db';

export function initializeDatabaseSchema() {
  db.exec(`
    -- 1. Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      full_name TEXT NOT NULL,
      phone TEXT,
      avatar_url TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_login_at TEXT,
      created_at TEXT NOT NULL DEFAULT (now()),
      updated_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

    -- 2. Roles
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    );

    -- 3. Permissions
    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );

    -- 4. Role Permissions
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      PRIMARY KEY (role_id, permission_id)
    );

    -- 5. User Roles (Session Scoped or Global)
    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      session_id TEXT,
      UNIQUE(user_id, role_id, session_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_session ON user_roles(session_id);

    -- 6. Academic Sessions
    CREATE TABLE IF NOT EXISTS academic_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- 7. Programs
    CREATE TABLE IF NOT EXISTS programs (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL
    );

    -- 8. Session Programs
    CREATE TABLE IF NOT EXISTS session_programs (
      session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
      program_id TEXT NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
      PRIMARY KEY (session_id, program_id)
    );

    -- 9. Project Types (10 Framework Categories)
    CREATE TABLE IF NOT EXISTS project_types (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      suitable_programs TEXT NOT NULL, -- JSON array of program codes
      objectives TEXT,
      ai_policy TEXT NOT NULL, -- NO_AI, API_ONLY, EXTENSIVE_ALLOWED, LIMITED
      ai_policy_notes TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL DEFAULT 1
    );

    -- 10. Project Groups
    CREATE TABLE IF NOT EXISTS project_groups (
      id TEXT PRIMARY KEY,
      group_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      project_type_id TEXT NOT NULL REFERENCES project_types(id) ON DELETE RESTRICT,
      session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'FORMING', -- FORMING, PROPOSED, APPROVED, IN_PROGRESS, EVALUATION, COMPLETED, ARCHIVED
      created_at TEXT NOT NULL DEFAULT (now()),
      updated_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_groups_session_status ON project_groups(session_id, status);

    -- 11. Group Memberships
    CREATE TABLE IF NOT EXISTS group_memberships (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      member_role TEXT NOT NULL DEFAULT 'MEMBER', -- LEADER, MEMBER
      joined_at TEXT NOT NULL DEFAULT (now()),
      UNIQUE(group_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_group_memberships_group ON group_memberships(group_id);
    CREATE INDEX IF NOT EXISTS idx_group_memberships_user ON group_memberships(user_id);

    -- 12. Proposals
    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL UNIQUE REFERENCES project_groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      abstract TEXT NOT NULL,
      problem_statement TEXT NOT NULL,
      objectives TEXT NOT NULL,
      scope TEXT NOT NULL,
      methodology TEXT NOT NULL,
      tools TEXT,
      timeline_text TEXT,
      document_url TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, SUBMITTED, UNDER_SUPERVISOR_REVIEW, UNDER_COORDINATOR_REVIEW, APPROVED, REJECTED, RESUBMISSION_REQUIRED
      version INTEGER NOT NULL DEFAULT 1,
      submitted_at TEXT,
      created_at TEXT NOT NULL DEFAULT (now()),
      updated_at TEXT NOT NULL DEFAULT (now())
    );

    -- 13. Proposal Reviews
    CREATE TABLE IF NOT EXISTS proposal_reviews (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      stage TEXT NOT NULL, -- SUPERVISOR, COORDINATOR, HOD
      decision TEXT NOT NULL, -- APPROVED, REJECTED, RESUBMISSION_REQUIRED, COMMENTED
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_proposal_reviews_proposal ON proposal_reviews(proposal_id);

    -- 14. Faculty Profiles
    CREATE TABLE IF NOT EXISTS faculty_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      designation TEXT NOT NULL,
      expertise_tags TEXT NOT NULL DEFAULT '[]', -- JSON array of tags
      max_supervision_load INTEGER NOT NULL DEFAULT 6
    );

    -- 15. Supervision Allocations
    CREATE TABLE IF NOT EXISTS supervision_allocations (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
      supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      alloc_role TEXT NOT NULL, -- SUPERVISOR, CO_SUPERVISOR, INDUSTRY_MENTOR
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REASSIGNED, ENDED
      allocated_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_allocations_supervisor ON supervision_allocations(supervisor_id, status);
    CREATE INDEX IF NOT EXISTS idx_allocations_group ON supervision_allocations(group_id, status);

    -- 16. Meetings
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      mode TEXT NOT NULL, -- IN_PERSON, ONLINE
      venue_link TEXT,
      agenda TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, COMPLETED, CANCELLED
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_meetings_group ON meetings(group_id, scheduled_at);

    -- 17. Meeting Attendance
    CREATE TABLE IF NOT EXISTS meeting_attendance (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      attendance TEXT NOT NULL, -- PRESENT, ABSENT, EXCUSED
      UNIQUE(meeting_id, user_id)
    );

    -- 18. Meeting Minutes
    CREATE TABLE IF NOT EXISTS meeting_minutes (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
      notes TEXT NOT NULL,
      decisions TEXT,
      supervisor_signed_off INTEGER NOT NULL DEFAULT 0,
      signed_off_at TEXT,
      effort_hours_logged REAL NOT NULL DEFAULT 0
    );

    -- 19. Action Items
    CREATE TABLE IF NOT EXISTS action_items (
      id TEXT PRIMARY KEY,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, DONE
      completed_at TEXT
    );

    -- 20. Milestones
    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
      project_type_id TEXT REFERENCES project_types(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      description TEXT,
      due_date TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );

    -- 21. Deliverable Templates (15 Common + Type-specific)
    CREATE TABLE IF NOT EXISTS deliverable_templates (
      id TEXT PRIMARY KEY,
      milestone_id TEXT REFERENCES milestones(id) ON DELETE CASCADE,
      project_type_id TEXT REFERENCES project_types(id) ON DELETE RESTRICT,
      title TEXT NOT NULL,
      description TEXT,
      is_required INTEGER NOT NULL DEFAULT 1
    );

    -- 22. Deliverable Submissions
    CREATE TABLE IF NOT EXISTS deliverable_submissions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
      template_id TEXT NOT NULL REFERENCES deliverable_templates(id) ON DELETE RESTRICT,
      version INTEGER NOT NULL DEFAULT 1,
      file_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      checksum_sha256 TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'SUBMITTED', -- SUBMITTED, UNDER_REVIEW, REVISION_REQUIRED, ACCEPTED
      submitted_at TEXT NOT NULL DEFAULT (now()),
      UNIQUE(group_id, template_id, version)
    );
    CREATE INDEX IF NOT EXISTS idx_submissions_group ON deliverable_submissions(group_id);

    -- 23. Submission Reviews
    CREATE TABLE IF NOT EXISTS submission_reviews (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES deliverable_submissions(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      decision TEXT NOT NULL, -- ACCEPTED, REVISION_REQUIRED, COMMENTED
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (now())
    );

    -- 24. AI Declarations (M11)
    CREATE TABLE IF NOT EXISTS ai_declarations (
      id TEXT PRIMARY KEY,
      submission_id TEXT NOT NULL REFERENCES deliverable_submissions(id) ON DELETE CASCADE,
      version INTEGER NOT NULL DEFAULT 1,
      ai_usage_level TEXT NOT NULL, -- NONE, API_ONLY, EXTENSIVE, LIMITED
      tools_used TEXT, -- JSON array of tool objects
      declaration_text TEXT NOT NULL,
      declared_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      supervisor_attested INTEGER NOT NULL DEFAULT 0,
      policy_flag INTEGER NOT NULL DEFAULT 0, -- 1 if policy mismatch
      policy_notes TEXT,
      created_at TEXT NOT NULL DEFAULT (now()),
      UNIQUE(submission_id, version)
    );

    -- 25. Evaluation Stages (E1 - E5, 100% total)
    CREATE TABLE IF NOT EXISTS evaluation_stages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES academic_sessions(id) ON DELETE CASCADE,
      code TEXT NOT NULL, -- E1, E2, E3, E4, E5
      name TEXT NOT NULL,
      weightage_percent REAL NOT NULL, -- 10, 20, 10, 30, 30
      sort_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN', -- DRAFT, OPEN, CLOSED
      UNIQUE(session_id, code)
    );

    -- 26. Rubrics
    CREATE TABLE IF NOT EXISTS rubrics (
      id TEXT PRIMARY KEY,
      evaluation_stage_id TEXT NOT NULL REFERENCES evaluation_stages(id) ON DELETE CASCADE,
      project_type_id TEXT REFERENCES project_types(id) ON DELETE RESTRICT,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    -- 27. Rubric Criteria
    CREATE TABLE IF NOT EXISTS rubric_criteria (
      id TEXT PRIMARY KEY,
      rubric_id TEXT NOT NULL REFERENCES rubrics(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      max_marks REAL NOT NULL,
      weightage REAL NOT NULL,
      sort_order INTEGER NOT NULL,
      level_descriptors TEXT NOT NULL DEFAULT '{}' -- JSON description
    );

    -- 28. Evaluations (Panel scheduling per group & stage)
    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
      stage_id TEXT NOT NULL REFERENCES evaluation_stages(id) ON DELETE RESTRICT,
      scheduled_at TEXT,
      venue TEXT,
      status TEXT NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, IN_PROGRESS, SCORED, MODERATED, PUBLISHED
      UNIQUE(group_id, stage_id)
    );

    -- 29. Evaluation Panels
    CREATE TABLE IF NOT EXISTS evaluation_panels (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      evaluator_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      panel_role TEXT NOT NULL, -- INTERNAL, EXTERNAL, CHAIR
      UNIQUE(evaluation_id, evaluator_id)
    );

    -- 30. Evaluation Scores (Criterion-level marks)
    CREATE TABLE IF NOT EXISTS evaluation_scores (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
      criterion_id TEXT NOT NULL REFERENCES rubric_criteria(id) ON DELETE RESTRICT,
      evaluator_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      marks_obtained REAL NOT NULL,
      comments TEXT,
      created_at TEXT NOT NULL DEFAULT (now()),
      UNIQUE(evaluation_id, criterion_id, evaluator_id)
    );

    -- 31. Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      notif_type TEXT NOT NULL,
      related_entity_type TEXT,
      related_entity_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);

    -- 32. Announcements
    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      session_id TEXT REFERENCES academic_sessions(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      audience_roles TEXT NOT NULL DEFAULT '[]', -- JSON array of roles
      published_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      published_at TEXT NOT NULL DEFAULT (now())
    );

    -- 33. Audit Logs (Immutable, append-only)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      old_values TEXT, -- JSON
      new_values TEXT, -- JSON
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);

    -- 34. Effort Entries (300 hours & 9 hours/week)
    CREATE TABLE IF NOT EXISTS effort_entries (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL REFERENCES project_groups(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      work_date TEXT NOT NULL,
      hours REAL NOT NULL,
      category TEXT NOT NULL, -- RESEARCH, DESIGN, BUILD, TEST, DOCUMENT, MEETING, OTHER
      description TEXT NOT NULL,
      evidence_url TEXT,
      verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL DEFAULT (now())
    );
    CREATE INDEX IF NOT EXISTS idx_effort_student ON effort_entries(student_id, work_date);
    CREATE INDEX IF NOT EXISTS idx_effort_group ON effort_entries(group_id, work_date);
  `);
}
