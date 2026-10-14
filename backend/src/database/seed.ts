import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { initializeDatabaseSchema } from './schema';

export function runSeeds() {
  initializeDatabaseSchema();

  // Check if already seeded
  const existingRole = db.queryOne('SELECT count(*) as count FROM roles');
  if (existingRole && existingRole.count > 0) {
    return;
  }

  db.transaction(() => {
    // 1. Seed Roles
    const roles = [
      { id: 1, name: 'SUPER_ADMIN', description: 'Platform-wide administration and operational maintenance' },
      { id: 2, name: 'FYP_COORDINATOR', description: 'Academic-session administrator, allocations, workflow and publication' },
      { id: 3, name: 'HOD', description: 'Departmental oversight, exception review, and final result ratification' },
      { id: 4, name: 'SUPERVISOR', description: 'Primary academic mentor, meetings, reviews, and continuous assessment' },
      { id: 5, name: 'CO_SUPERVISOR', description: 'Supporting academic mentor with delegated supervisory actions' },
      { id: 6, name: 'STUDENT', description: 'Project participant, group member or leader submitting academic evidence' },
      { id: 7, name: 'INTERNAL_EVALUATOR', description: 'Institutional assessor scoring assigned stages and rubrics' },
      { id: 8, name: 'EXTERNAL_EXAMINER', description: 'Industry or external academic assessor scoring final viva' },
      { id: 9, name: 'INDUSTRY_PARTNER', description: 'External project client providing requirements and acceptance feedback' }
    ];

    for (const r of roles) {
      db.execute('INSERT OR IGNORE INTO roles (id, name, description) VALUES (?, ?, ?)', [r.id, r.name, r.description]);
    }

    // 2. Seed Permissions
    const permissions = [
      { code: 'users.read', description: 'View user profiles and rosters' },
      { code: 'users.manage', description: 'Create and update user accounts' },
      { code: 'roles.assign', description: 'Assign roles to users' },
      { code: 'groups.create', description: 'Create project groups' },
      { code: 'groups.approve', description: 'Approve or reject group registration' },
      { code: 'groups.archive', description: 'Archive groups upon completion' },
      { code: 'proposals.submit', description: 'Submit and revise proposals' },
      { code: 'proposals.review', description: 'Review and comment on proposals' },
      { code: 'proposals.approve', description: 'Approve or reject proposals' },
      { code: 'allocations.manage', description: 'Assign and reassign supervisors' },
      { code: 'meetings.sign_off', description: 'Sign off supervisory meeting minutes' },
      { code: 'submissions.submit', description: 'Upload milestone deliverables and AI declarations' },
      { code: 'submissions.review', description: 'Review and accept deliverable submissions' },
      { code: 'panels.manage', description: 'Form and schedule evaluation panels' },
      { code: 'scores.write', description: 'Submit criterion evaluation marks' },
      { code: 'evaluations.moderate', description: 'Moderate and adjust panel score aggregates' },
      { code: 'results.publish', description: 'Publish final approved evaluation results' },
      { code: 'sessions.manage', description: 'Create and configure academic sessions and calendars' },
      { code: 'milestones.manage', description: 'Configure session milestones and deliverable templates' },
      { code: 'rubrics.manage', description: 'Build and version scoring rubrics' },
      { code: 'audit.read', description: 'Inspect append-only audit trail' },
      { code: 'reports.export', description: 'Generate and download official CSV/PDF reports' }
    ];

    for (const p of permissions) {
      db.execute('INSERT OR IGNORE INTO permissions (code, description) VALUES (?, ?)', [p.code, p.description]);
    }

    // 3. Seed Programs
    const programs = [
      { id: uuidv4(), code: 'CS', name: 'BS Computer Science' },
      { id: uuidv4(), code: 'SE', name: 'BS Software Engineering' },
      { id: uuidv4(), code: 'IT', name: 'BS Information Technology' },
      { id: uuidv4(), code: 'AI', name: 'BS Artificial Intelligence' },
      { id: uuidv4(), code: 'DS', name: 'BS Data Science' },
      { id: uuidv4(), code: 'CY', name: 'BS Cybersecurity' },
      { id: uuidv4(), code: 'CGV', name: 'BS Computer Graphics & Visualization' }
    ];

    for (const prog of programs) {
      db.execute('INSERT OR IGNORE INTO programs (id, code, name) VALUES (?, ?, ?)', [prog.id, prog.code, prog.name]);
    }

    // 4. Seed Active Academic Session (Fall 2026)
    const sessionId = uuidv4();
    db.execute(`
      INSERT OR IGNORE INTO academic_sessions (id, name, start_date, end_date, is_active)
      VALUES (?, ?, ?, ?, 1)
    `, [sessionId, 'Fall 2026', '2026-09-01', '2027-06-30']);

    // Link programs to session
    for (const prog of programs) {
      db.execute('INSERT OR IGNORE INTO session_programs (session_id, program_id) VALUES (?, ?)', [sessionId, prog.id]);
    }

    // 5. Seed 10 Official FYP Project Types (RSCI Framework v1.0)
    const projectTypes = [
      {
        id: uuidv4(),
        code: 'PRODUCT_DEV',
        name: 'Product Development Project',
        description: 'Complete SDLC-based software or hardware solution to a real-world problem. Students follow the complete Software Development Life Cycle and software engineering principles.',
        suitable_programs: JSON.stringify(['CS', 'SE', 'IT']),
        objectives: 'Demonstrate software engineering competencies; develop reliable computing solution; apply modern technologies; validate through testing and evaluation.',
        ai_policy: 'NO_AI',
        ai_policy_notes: 'No AI usage/assistance in core functionalities and documentation; AI application through APIs is allowed.'
      },
      {
        id: uuidv4(),
        code: 'ENTREPRENEURIAL',
        name: 'Entrepreneurial Project',
        description: 'Technology product or service with commercial potential, market validation, and a Minimum Viable Product (MVP).',
        suitable_programs: JSON.stringify(['CS', 'SE', 'IT']),
        objectives: 'Develop entrepreneurial and innovation skills; validate market demand; create scalable business model; demonstrate commercialization potential.',
        ai_policy: 'EXTENSIVE_ALLOWED',
        ai_policy_notes: 'Students can extensively use AI for product development and documentation.'
      },
      {
        id: uuidv4(),
        code: 'INDUSTRY_CONTINUATION',
        name: 'Continuation Project (Existing product based Project)',
        description: 'Industry-collaborative work solving an actual organizational problem using industrial standards, methodologies, and professional practices.',
        suitable_programs: JSON.stringify(['CS', 'SE', 'IT', 'CY', 'DS', 'AI', 'CGV']),
        objectives: 'Deliver practical business value; gain industrial experience; meet client expectations; improve teamwork and stakeholder communication.',
        ai_policy: 'LIMITED',
        ai_policy_notes: 'AI usage allowed depending on project for new features development; AI application through APIs is allowed; No AI usage in documentation.'
      },
      {
        id: uuidv4(),
        code: 'RESEARCH',
        name: 'Research Project',
        description: 'Scientific investigation of a computing problem through literature review, experimentation, data analysis, and validation to generate new knowledge or improve existing methods.',
        suitable_programs: JSON.stringify(['CS', 'AI', 'CY', 'DS']),
        objectives: 'Apply scientific research methodology; evaluate existing techniques; develop and validate a novel approach; produce publishable research findings.',
        ai_policy: 'NO_AI',
        ai_policy_notes: 'No AI usage/assistance in core functionalities and documentation; AI application through APIs is allowed.'
      },
      {
        id: uuidv4(),
        code: 'IOT_EMBEDDED',
        name: 'IoT & Embedded Systems Project',
        description: 'Design and implementation of intelligent systems integrating sensors, embedded devices, communication technologies, cloud platforms, and software applications.',
        suitable_programs: JSON.stringify(['CS', 'SE', 'IT']),
        objectives: 'Develop integrated hardware-software solutions; demonstrate IoT architecture design; collect and process sensor data; validate performance and reliability.',
        ai_policy: 'NO_AI',
        ai_policy_notes: 'No AI usage/assistance in core functionalities and documentation; AI application through APIs is allowed.'
      },
      {
        id: uuidv4(),
        code: 'CASE_STUDY',
        name: 'Case Study Project',
        description: 'Systematic investigation of an existing organization, technology, information system, or computing problem to analyze current practices, identify issues, and recommend improvements.',
        suitable_programs: JSON.stringify(['IT', 'CY', 'DS']),
        objectives: 'Develop analytical and critical thinking skills; evaluate existing systems objectively; recommend evidence-based solutions; demonstrate professional reporting.',
        ai_policy: 'LIMITED',
        ai_policy_notes: 'Limited AI usage/assistance in core functionalities and No Usage in documentation.'
      },
      {
        id: uuidv4(),
        code: 'CONSULT_AI_DA',
        name: 'Consulting Project (AI/Data Analytics)',
        description: 'A consultancy-based project analyzing organizational data and providing AI- or analytics-driven recommendations to improve business performance and decision-making.',
        suitable_programs: JSON.stringify(['AI', 'DS']),
        objectives: 'Apply AI and data analytics to real organizational problems; generate actionable business insights; improve decision-making using data; demonstrate consulting skills.',
        ai_policy: 'LIMITED',
        ai_policy_notes: 'No AI usage/assistance in documentation.'
      },
      {
        id: uuidv4(),
        code: 'CONSULT_CYBER',
        name: 'Consulting Project (Cybersecurity)',
        description: 'Cybersecurity consultancy project involving security assessment, vulnerability analysis, risk management, compliance evaluation, and security improvement recommendations.',
        suitable_programs: JSON.stringify(['CY', 'IT']),
        objectives: 'Identify security vulnerabilities; assess organizational cyber risks; recommend appropriate security controls; demonstrate cybersecurity consulting practices.',
        ai_policy: 'LIMITED',
        ai_policy_notes: 'No AI usage/assistance in documentation.'
      },
      {
        id: uuidv4(),
        code: 'CONSULT_CLOUD_DEVOPS',
        name: 'Consulting Project (Cloud & DevOps)',
        description: 'Consultancy project focused on evaluating cloud infrastructure, DevOps maturity, application modernization, automation, and cloud adoption strategies.',
        suitable_programs: JSON.stringify(['IT', 'CS', 'SE']),
        objectives: 'Assess cloud readiness; recommend scalable cloud architectures; improve deployment automation; optimize operational efficiency.',
        ai_policy: 'LIMITED',
        ai_policy_notes: 'No AI usage/assistance in documentation.'
      },
      {
        id: uuidv4(),
        code: 'CONSULT_DIGITAL_TX',
        name: 'Consulting Project (Digital Transformation)',
        description: 'Analyzes organizational processes and develops a comprehensive digital transformation strategy using modern computing technologies such as AI, cloud, automation, and data analytics.',
        suitable_programs: JSON.stringify(['IT', 'CS', 'SE']),
        objectives: 'Evaluate organizational digital maturity; recommend technology-driven transformation initiatives; improve operational efficiency and customer experience; develop transformation roadmap.',
        ai_policy: 'LIMITED',
        ai_policy_notes: 'No AI usage/assistance in documentation.'
      }
    ];

    for (const pt of projectTypes) {
      db.execute(`
        INSERT OR IGNORE INTO project_types (id, code, name, description, suitable_programs, objectives, ai_policy, ai_policy_notes, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [pt.id, pt.code, pt.name, pt.description, pt.suitable_programs, pt.objectives, pt.ai_policy, pt.ai_policy_notes]);
    }

    // 6. Seed Milestones and 15 Common Deliverable Templates (SRS 7.2)
    const m1Id = uuidv4();
    const m2Id = uuidv4();
    const m3Id = uuidv4();
    const m4Id = uuidv4();
    const m5Id = uuidv4();

    db.execute('INSERT OR IGNORE INTO milestones (id, session_id, title, description, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [m1Id, sessionId, 'Milestone 1: Project Inception & Proposal', 'Initial topic registration, problem statement and proposal defense', '2026-10-31', 1]);
    db.execute('INSERT OR IGNORE INTO milestones (id, session_id, title, description, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [m2Id, sessionId, 'Milestone 2: Requirements & Architecture', 'Comprehensive SRS/SDD, literature review, and preliminary system design', '2026-12-15', 2]);
    db.execute('INSERT OR IGNORE INTO milestones (id, session_id, title, description, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [m3Id, sessionId, 'Milestone 3: Mid-Term Progress & Verification', 'Working module implementation, mid-term evaluation defense, and logbook review', '2027-02-28', 3]);
    db.execute('INSERT OR IGNORE INTO milestones (id, session_id, title, description, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [m4Id, sessionId, 'Milestone 4: Testing & Final Demonstration', 'Complete functional validation, comprehensive test reports, and live demonstration', '2027-05-15', 4]);
    db.execute('INSERT OR IGNORE INTO milestones (id, session_id, title, description, due_date, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [m5Id, sessionId, 'Milestone 5: Final Report & Viva Voce', 'Bound final project report, poster presentation, user manuals, and oral defense', '2027-06-20', 5]);

    const commonDeliverables = [
      { id: uuidv4(), milestone_id: m1Id, title: 'Project Proposal Document', desc: 'Formal proposal document defining topic, background, and objectives.' },
      { id: uuidv4(), milestone_id: m1Id, title: 'Problem Statement and Objectives', desc: 'Concrete problem definition and measurable goals.' },
      { id: uuidv4(), milestone_id: m2Id, title: 'Literature Review / Background Study', desc: 'Systematic analysis of prior academic or industrial work.' },
      { id: uuidv4(), milestone_id: m1Id, title: 'Project Planning and Timeline (Gantt)', desc: 'Work breakdown structure, schedule, and milestone dates.' },
      { id: uuidv4(), milestone_id: m2Id, title: 'Software Requirements Specification (SRS)', desc: 'Formal functional, non-functional, and interface requirements.' },
      { id: uuidv4(), milestone_id: m2Id, title: 'Design and Methodology (SDD)', desc: 'Architectural diagrams, database design, and workflow schemas.' },
      { id: uuidv4(), milestone_id: m3Id, title: 'Implementation & Source Code Repository', desc: 'Primary codebase with clean commit history and documentation.' },
      { id: uuidv4(), milestone_id: m4Id, title: 'Validation, Testing & Evaluation Report', desc: 'Unit, integration, and user-acceptance test evidence.' },
      { id: uuidv4(), milestone_id: m5Id, title: 'Final Comprehensive Project Report', desc: 'Complete institutional thesis document following RSCI format.' },
      { id: uuidv4(), milestone_id: m5Id, title: 'Poster and Demonstration Artifacts', desc: 'A1 conference poster and recorded system demonstration video.' },
      { id: uuidv4(), milestone_id: m5Id, title: 'Oral Defense Presentation Slides', desc: 'Executive slide deck for evaluation panel.' },
      { id: uuidv4(), milestone_id: m4Id, title: 'Source Code / Prototype / Dataset Delivery', desc: 'Complete packaging of deliverables and installation scripts.' },
      { id: uuidv4(), milestone_id: m5Id, title: 'User and Technical Documentation', desc: 'Deployment runbook, administrator guide, and user manual.' },
      { id: uuidv4(), milestone_id: m5Id, title: 'Reflection on Outcomes and Future Work', desc: 'Retrospective analysis, limitations, and future enhancements.' },
      { id: uuidv4(), milestone_id: m3Id, title: 'Supervisory Logbook (300 Hours Target)', desc: 'Signed meeting minutes and logged weekly student effort.' }
    ];

    for (const d of commonDeliverables) {
      db.execute('INSERT OR IGNORE INTO deliverable_templates (id, milestone_id, title, description, is_required) VALUES (?, ?, ?, ?, 1)',
        [d.id, d.milestone_id, d.title, d.desc]);
    }

    // 7. Seed Evaluation Stages (E1 - E5) totaling 100% (SRS 6.1)
    const stages = [
      { id: uuidv4(), code: 'E1', name: 'Proposal Defense', weight: 10, sort: 1 },
      { id: uuidv4(), code: 'E2', name: 'Mid-Term Evaluation', weight: 20, sort: 2 },
      { id: uuidv4(), code: 'E3', name: 'Continuous Supervisor Assessment', weight: 10, sort: 3 },
      { id: uuidv4(), code: 'E4', name: 'Final Demonstration', weight: 30, sort: 4 },
      { id: uuidv4(), code: 'E5', name: 'Final Report & Oral Defense (Viva)', weight: 30, sort: 5 }
    ];

    for (const s of stages) {
      db.execute(`
        INSERT OR IGNORE INTO evaluation_stages (id, session_id, code, name, weightage_percent, sort_order, status)
        VALUES (?, ?, ?, ?, ?, ?, 'OPEN')
      `, [s.id, sessionId, s.code, s.name, s.weight, s.sort]);
    }

    // 8. Seed Rubrics and Criteria for E1-E5 (SRS 6.2)
    const stageE1 = stages[0];
    const rubricE1Id = uuidv4();
    db.execute('INSERT OR IGNORE INTO rubrics (id, evaluation_stage_id, name, is_active) VALUES (?, ?, ?, 1)',
      [rubricE1Id, stageE1.id, 'E1 Proposal Defense Official Rubric']);

    const criteriaE1 = [
      { name: 'Problem Definition & Motivation', max: 20, weight: 20, sort: 1 },
      { name: 'Objectives & Scope Clarity', max: 15, weight: 15, sort: 2 },
      { name: 'Literature / Background Awareness', max: 15, weight: 15, sort: 3 },
      { name: 'Methodology & Work Plan', max: 20, weight: 20, sort: 4 },
      { name: 'Feasibility, Timeline & Risk Awareness', max: 15, weight: 15, sort: 5 },
      { name: 'Presentation & Q&A', max: 15, weight: 15, sort: 6 }
    ];
    for (const c of criteriaE1) {
      db.execute('INSERT OR IGNORE INTO rubric_criteria (id, rubric_id, name, max_marks, weightage, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), rubricE1Id, c.name, c.max, c.weight, c.sort]);
    }

    const stageE2 = stages[1];
    const rubricE2Id = uuidv4();
    db.execute('INSERT OR IGNORE INTO rubrics (id, evaluation_stage_id, name, is_active) VALUES (?, ?, ?, 1)',
      [rubricE2Id, stageE2.id, 'E2 Mid-Term Evaluation Official Rubric']);

    const criteriaE2 = [
      { name: 'Progress vs Planned Timeline', max: 25, weight: 25, sort: 1 },
      { name: 'Technical Depth & Quality of Work', max: 25, weight: 25, sort: 2 },
      { name: 'Documentation (SRS/SDD as applicable)', max: 20, weight: 20, sort: 3 },
      { name: 'Teamwork & Individual Contribution', max: 15, weight: 15, sort: 4 },
      { name: 'Mid-term Presentation & Q&A', max: 15, weight: 15, sort: 5 }
    ];
    for (const c of criteriaE2) {
      db.execute('INSERT OR IGNORE INTO rubric_criteria (id, rubric_id, name, max_marks, weightage, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), rubricE2Id, c.name, c.max, c.weight, c.sort]);
    }

    const stageE3 = stages[2];
    const rubricE3Id = uuidv4();
    db.execute('INSERT OR IGNORE INTO rubrics (id, evaluation_stage_id, name, is_active) VALUES (?, ?, ?, 1)',
      [rubricE3Id, stageE3.id, 'E3 Continuous Supervisor Assessment Rubric']);

    const criteriaE3 = [
      { name: 'Regularity & Meeting Discipline', max: 25, weight: 25, sort: 1 },
      { name: 'Initiative & Professionalism', max: 25, weight: 25, sort: 2 },
      { name: 'Technical Ownership of Progress', max: 25, weight: 25, sort: 3 },
      { name: 'Documentation Discipline & Effort Logs', max: 25, weight: 25, sort: 4 }
    ];
    for (const c of criteriaE3) {
      db.execute('INSERT OR IGNORE INTO rubric_criteria (id, rubric_id, name, max_marks, weightage, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), rubricE3Id, c.name, c.max, c.weight, c.sort]);
    }

    const stageE4 = stages[3];
    const rubricE4Id = uuidv4();
    db.execute('INSERT OR IGNORE INTO rubrics (id, evaluation_stage_id, name, is_active) VALUES (?, ?, ?, 1)',
      [rubricE4Id, stageE4.id, 'E4 Final Demonstration Official Rubric']);

    const criteriaE4 = [
      { name: 'Completeness vs Objectives', max: 25, weight: 25, sort: 1 },
      { name: 'Technical Complexity & Quality', max: 20, weight: 20, sort: 2 },
      { name: 'Innovation / Novelty or Business Value', max: 15, weight: 15, sort: 3 },
      { name: 'Testing / Validation & Results', max: 20, weight: 20, sort: 4 },
      { name: 'Live Demonstration & Technical Q&A', max: 20, weight: 20, sort: 5 }
    ];
    for (const c of criteriaE4) {
      db.execute('INSERT OR IGNORE INTO rubric_criteria (id, rubric_id, name, max_marks, weightage, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), rubricE4Id, c.name, c.max, c.weight, c.sort]);
    }

    const stageE5 = stages[4];
    const rubricE5Id = uuidv4();
    db.execute('INSERT OR IGNORE INTO rubrics (id, evaluation_stage_id, name, is_active) VALUES (?, ?, ?, 1)',
      [rubricE5Id, stageE5.id, 'E5 Final Report & Viva Voce Rubric']);

    const criteriaE5 = [
      { name: 'Report Structure & Writing Quality', max: 20, weight: 20, sort: 1 },
      { name: 'Literature Review & Citation Rigor', max: 15, weight: 15, sort: 2 },
      { name: 'Methodology / Design Description', max: 15, weight: 15, sort: 3 },
      { name: 'Results, Analysis & Evaluation', max: 20, weight: 20, sort: 4 },
      { name: 'Conclusion & Future Work', max: 10, weight: 10, sort: 5 },
      { name: 'Viva Voce & Individual Understanding', max: 20, weight: 20, sort: 6 }
    ];
    for (const c of criteriaE5) {
      db.execute('INSERT OR IGNORE INTO rubric_criteria (id, rubric_id, name, max_marks, weightage, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
        [uuidv4(), rubricE5Id, c.name, c.max, c.weight, c.sort]);
    }

    // 9. Seed Authentic Institutional Demonstration Accounts (No dummy garbage, real academic profiles)
    const salt = bcrypt.genSaltSync(10);
    const standardHash = bcrypt.hashSync('RsciPortal2026!', salt);

    const initialUsers = [
      {
        id: uuidv4(),
        email: 'admin@rsci.edu.pk',
        name: 'System Administrator',
        roleId: 1, // SUPER_ADMIN
        phone: '+92 51 111 747 424',
        global: true
      },
      {
        id: uuidv4(),
        email: 'coordinator@rsci.edu.pk',
        name: 'Dr. Muhammad Asim',
        roleId: 2, // FYP_COORDINATOR
        phone: '+92 51 289 1201',
        global: false,
        designation: 'Associate Professor & FYP Head',
        tags: ['Distributed Systems', 'Software Architecture', 'Cloud Computing']
      },
      {
        id: uuidv4(),
        email: 'hod.cs@rsci.edu.pk',
        name: 'Prof. Dr. Naveed Akhtar',
        roleId: 3, // HOD
        phone: '+92 51 289 1200',
        global: false,
        designation: 'Professor & Head of Department',
        tags: ['Machine Learning', 'Computer Vision']
      },
      {
        id: uuidv4(),
        email: 'supervisor@rsci.edu.pk',
        name: 'Dr. Tariq Mahmood',
        roleId: 4, // SUPERVISOR
        phone: '+92 51 289 1205',
        global: false,
        designation: 'Associate Professor',
        tags: ['Web Technologies', 'Cloud & DevOps', 'Distributed Systems']
      },
      {
        id: uuidv4(),
        email: 'evaluator@rsci.edu.pk',
        name: 'Dr. Ayesha Malik',
        roleId: 7, // INTERNAL_EVALUATOR
        phone: '+92 51 289 1210',
        global: false,
        designation: 'Assistant Professor',
        tags: ['Information Security', 'Software Testing']
      },
      {
        id: uuidv4(),
        email: 'external@industry.com.pk',
        name: 'Engr. Bilal Khan',
        roleId: 8, // EXTERNAL_EXAMINER
        phone: '+92 300 555 1234',
        global: false
      },
      {
        id: uuidv4(),
        email: 'student.lead@students.rsci.edu.pk',
        name: 'Hamza Ahmed',
        roleId: 6, // STUDENT
        phone: '+92 333 456 7890',
        global: false
      },
      {
        id: uuidv4(),
        email: 'student.member@students.rsci.edu.pk',
        name: 'Fatima Noor',
        roleId: 6, // STUDENT
        phone: '+92 334 567 8901',
        global: false
      }
    ];

    for (const u of initialUsers) {
      db.execute(`
        INSERT OR IGNORE INTO users (id, email, password_hash, full_name, phone, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
      `, [u.id, u.email, standardHash, u.name, u.phone]);

      // Assign role (session-scoped for academic roles, global for super admin)
      db.execute(`
        INSERT OR IGNORE INTO user_roles (id, user_id, role_id, session_id)
        VALUES (?, ?, ?, ?)
      `, [uuidv4(), u.id, u.roleId, u.global ? null : sessionId]);

      if (u.designation) {
        db.execute(`
          INSERT OR IGNORE INTO faculty_profiles (user_id, designation, expertise_tags, max_supervision_load)
          VALUES (?, ?, ?, 6)
        `, [u.id, u.designation, JSON.stringify(u.tags || [])]);
      }
    }

    // 10. Seed Initial Institutional Announcement
    const adminUser = initialUsers[0];
    db.execute(`
      INSERT OR IGNORE INTO announcements (id, session_id, title, body, audience_roles, published_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      uuidv4(),
      sessionId,
      'Welcome to RSCI Final Year Project Portal (Fall 2026)',
      'The RSCI FYP Portal is now live for all BS Computing disciplines. Students are advised to consult the 10 Project Pathways and review the specific AI Usage policies before finalizing group registrations and submitting project proposals.',
      JSON.stringify(['STUDENT', 'SUPERVISOR', 'CO_SUPERVISOR', 'FYP_COORDINATOR', 'HOD']),
      adminUser.id
    ]);

    // 11. Seed Baseline Official Project Group (FYP-F26-001)
    const productDevType = projectTypes[0]; // PRODUCT_DEV
    const studentLead = initialUsers[6]; // Hamza Ahmed
    const studentMember = initialUsers[7]; // Fatima Noor
    const supervisorUser = initialUsers[3]; // Dr. Tariq Mahmood

    const groupId = uuidv4();
    const groupCode = 'FYP-F26-001';
    const groupTitle = 'Autonomous Edge Computing Platform for Industrial Telemetry';

    db.execute(`
      INSERT OR IGNORE INTO project_groups (id, group_code, title, project_type_id, session_id, status)
      VALUES (?, ?, ?, ?, ?, 'APPROVED')
    `, [groupId, groupCode, groupTitle, productDevType.id, sessionId]);

    // Memberships
    db.execute(`
      INSERT OR IGNORE INTO group_memberships (id, group_id, user_id, member_role)
      VALUES (?, ?, ?, 'LEADER')
    `, [uuidv4(), groupId, studentLead.id]);

    db.execute(`
      INSERT OR IGNORE INTO group_memberships (id, group_id, user_id, member_role)
      VALUES (?, ?, ?, 'MEMBER')
    `, [uuidv4(), groupId, studentMember.id]);

    // Proposal
    const proposalId = uuidv4();
    db.execute(`
      INSERT OR IGNORE INTO proposals (
        id, group_id, title, abstract, problem_statement, objectives, scope, methodology, tools, timeline_text, status, version, submitted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED', 1, '2026-09-14 10:00:00')
    `, [
      proposalId,
      groupId,
      groupTitle,
      'This project develops an edge-computing solution for real-time sensor processing and telemetry in industrial environments. Using containerized microservices and constrained edge gateways, the platform reduces latency and ensures operational resilience.',
      'Industrial manufacturing facilities face critical delays in centralized cloud-only monitoring architectures, leading to delayed anomaly detection and equipment wear.',
      '1. Design modular edge telemetry gateway architecture.\n2. Implement sub-100ms local anomaly detection algorithms.\n3. Provide cloud aggregation dashboard with end-to-end TLS telemetry.',
      'In-scope: Gateway daemon, MQTT-SN broker, local anomaly detector, cloud ingest API. Out-of-scope: Proprietary PLC ladder logic re-compilation.',
      'Agile SDLC with hardware-in-the-loop simulation, embedded C++ and Go microservices, and automated testing.',
      'Rust, C++, Go, MQTT, TimescaleDB, Docker, React, Vite',
      'Sprint 1-3: Architecture & Gateway; Sprint 4-6: Anomaly Engine; Sprint 7-8: Testing & Viva'
    ]);

    // Proposal Review
    db.execute(`
      INSERT OR IGNORE INTO proposal_reviews (id, proposal_id, reviewer_id, stage, decision, comments)
      VALUES (?, ?, ?, 'COORDINATOR', 'APPROVED', 'Scope is rigorous, objectives are measurable, and alignment with BSSE standards is verified.')
    `, [uuidv4(), proposalId, initialUsers[1].id]);

    // Supervisor Allocation
    const allocationId = uuidv4();
    db.execute(`
      INSERT OR IGNORE INTO supervision_allocations (id, group_id, supervisor_id, alloc_role, status)
      VALUES (?, ?, ?, 'SUPERVISOR', 'ACTIVE')
    `, [allocationId, groupId, supervisorUser.id]);

    // Completed Advisory Meeting
    const meetingId = uuidv4();
    db.execute(`
      INSERT OR IGNORE INTO meetings (id, group_id, title, scheduled_at, duration_minutes, mode, venue_link, agenda, status, created_by)
      VALUES (?, ?, ?, '2026-09-15 10:00:00', 60, 'IN_PERSON', 'Faculty Office B-204', 'Inception & Requirements Baseline Review', 'COMPLETED', ?)
    `, [meetingId, groupId, 'Inception & Requirements Baseline Review', supervisorUser.id]);

    // Meeting Attendance
    db.execute('INSERT OR IGNORE INTO meeting_attendance (id, meeting_id, user_id, attendance) VALUES (?, ?, ?, "PRESENT")',
      [uuidv4(), meetingId, studentLead.id]);
    db.execute('INSERT OR IGNORE INTO meeting_attendance (id, meeting_id, user_id, attendance) VALUES (?, ?, ?, "PRESENT")',
      [uuidv4(), meetingId, studentMember.id]);

    // Meeting Minutes (Signed Off)
    db.execute(`
      INSERT OR IGNORE INTO meeting_minutes (id, meeting_id, notes, decisions, supervisor_signed_off, signed_off_at, effort_hours_logged)
      VALUES (?, ?, ?, ?, 1, '2026-09-15 11:30:00', 2.0)
    `, [
      uuidv4(),
      meetingId,
      'Reviewed system architecture diagram and protocol comparison between MQTT and OPC-UA. Confirmed requirement for local persistence buffer.',
      'Proceed with Rust implementation for the ingestion daemon; establish unit test suite with 85% branch coverage target.'
    ]);

    // Verified Effort Entries (Test Plan TC-MT-04 fixture: 8.0, 9.5, 7.5 hours = 25.0 verified hours)
    db.execute(`
      INSERT OR IGNORE INTO effort_entries (id, group_id, student_id, work_date, hours, category, description, verified_by, verified_at)
      VALUES (?, ?, ?, '2026-09-20', 8.0, 'RESEARCH', 'Literature survey on MQTT-SN and industrial telemetry protocols', ?, '2026-09-22 09:00:00')
    `, [uuidv4(), groupId, studentLead.id, supervisorUser.id]);

    db.execute(`
      INSERT OR IGNORE INTO effort_entries (id, group_id, student_id, work_date, hours, category, description, verified_by, verified_at)
      VALUES (?, ?, ?, '2026-09-28', 9.5, 'DESIGN', 'Architectural schema design and containerized gateway topology', ?, '2026-09-30 09:00:00')
    `, [uuidv4(), groupId, studentLead.id, supervisorUser.id]);

    db.execute(`
      INSERT OR IGNORE INTO effort_entries (id, group_id, student_id, work_date, hours, category, description, verified_by, verified_at)
      VALUES (?, ?, ?, '2026-10-05', 7.5, 'BUILD', 'Implementation of edge telemetry ingestion daemon in Rust/C++', ?, '2026-10-07 09:00:00')
    `, [uuidv4(), groupId, studentLead.id, supervisorUser.id]);

    // Initial audit log entry
    db.execute(`
      INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, new_values, ip_address)
      VALUES (?, ?, 'SYSTEM_INITIALIZED', 'academic_session', ?, ?, '127.0.0.1')
    `, [uuidv4(), adminUser.id, sessionId, JSON.stringify({ session: 'Fall 2026', seeded_types: 10, seeded_stages: 5, baseline_group: groupCode })]);
  });
}
