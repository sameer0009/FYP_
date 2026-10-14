export interface User {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  roles: string[];
  active_role?: string;
  designation?: string;
  expertise_tags?: string[];
  current_load?: number;
  max_supervision_load?: number;
}

export interface AcademicSession {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  programs_count?: number;
  groups_count?: number;
}

export interface ProjectType {
  id: string;
  code: string;
  name: string;
  description: string;
  suitable_programs: string[];
  objectives: string;
  ai_policy: 'NO_AI' | 'API_ONLY' | 'EXTENSIVE_ALLOWED' | 'LIMITED';
  ai_policy_notes: string;
  is_active: boolean;
  version: number;
}

export interface GroupMember {
  membership_id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  member_role: 'LEADER' | 'MEMBER';
  joined_at: string;
}

export interface ProjectGroup {
  id: string;
  group_code: string;
  title: string;
  status: 'FORMING' | 'PROPOSED' | 'APPROVED' | 'IN_PROGRESS' | 'EVALUATION' | 'COMPLETED' | 'ARCHIVED';
  project_type_id: string;
  project_type_name: string;
  project_type_code: string;
  ai_policy: string;
  ai_policy_notes?: string;
  session_id: string;
  session_name: string;
  created_at: string;
  members_count?: number;
  leader_name?: string;
  supervisor_name?: string;
  proposal_status?: string;
  proposal_id?: string;
  members?: GroupMember[];
  proposal?: Proposal;
  supervisor?: {
    allocation_id: string;
    alloc_role: string;
    status: string;
    user_id: string;
    full_name: string;
    email: string;
    designation: string;
  };
}

export interface Proposal {
  id: string;
  group_id: string;
  group_code?: string;
  group_title?: string;
  title: string;
  abstract: string;
  problem_statement: string;
  objectives: string;
  scope: string;
  methodology: string;
  tools?: string;
  timeline_text?: string;
  document_url?: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_SUPERVISOR_REVIEW' | 'UNDER_COORDINATOR_REVIEW' | 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED';
  version: number;
  submitted_at?: string;
  created_at: string;
  updated_at: string;
  reviews?: ProposalReview[];
}

export interface ProposalReview {
  id: string;
  proposal_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_email: string;
  stage: 'SUPERVISOR' | 'COORDINATOR' | 'HOD';
  decision: 'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED' | 'COMMENTED';
  comments: string;
  created_at: string;
}

export interface SupervisionAllocation {
  id: string;
  group_id: string;
  group_code: string;
  group_title: string;
  supervisor_id: string;
  supervisor_name: string;
  supervisor_email: string;
  designation: string;
  alloc_role: 'SUPERVISOR' | 'CO_SUPERVISOR' | 'INDUSTRY_MENTOR';
  status: 'ACTIVE' | 'REASSIGNED' | 'ENDED';
  allocated_at: string;
}

export interface Meeting {
  id: string;
  group_id: string;
  title: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: 'IN_PERSON' | 'ONLINE';
  venue_link?: string;
  agenda?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  created_by: string;
  organizer_name: string;
  created_at: string;
  minutes_notes?: string;
  minutes_decisions?: string;
  supervisor_signed_off?: boolean | number;
  signed_off_at?: string;
  effort_hours_logged?: number;
  attendance?: Array<{
    user_id: string;
    full_name: string;
    email: string;
    attendance: 'PRESENT' | 'ABSENT' | 'EXCUSED';
  }>;
  actions?: Array<{
    id: string;
    description: string;
    owner_id: string;
    owner_name: string;
    due_date?: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'DONE';
  }>;
}

export interface EffortEntry {
  id: string;
  group_id: string;
  student_id: string;
  student_name: string;
  work_date: string;
  hours: number;
  category: 'RESEARCH' | 'DESIGN' | 'BUILD' | 'TEST' | 'DOCUMENT' | 'MEETING' | 'OTHER';
  description: string;
  evidence_url?: string;
  verified_by?: string;
  verifier_name?: string;
  verified_at?: string;
  created_at: string;
}

export interface EffortSummary {
  group_id: string;
  target_hours: number;
  total_hours: number;
  verified_hours: number;
  progress_percent: number;
  weekly_guideline_hours: number;
  members: Array<{
    student_id: string;
    student_name: string;
    total_hours: number;
    verified_hours: number;
  }>;
  weekly_trend: Array<{
    week_code: string;
    week_start: string;
    weekly_hours: number;
  }>;
  entries: EffortEntry[];
}

export interface DeliverableTemplate {
  id: string;
  milestone_id: string;
  milestone_title: string;
  milestone_due_date: string;
  milestone_order: number;
  title: string;
  description: string;
  is_required: boolean | number;
  submission_count: number;
  latest_status?: 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUIRED' | 'ACCEPTED';
  latest_submission_id?: string;
}

export interface DeliverableSubmission {
  id: string;
  group_id: string;
  template_id: string;
  deliverable_title: string;
  milestone_title: string;
  version: number;
  file_url: string;
  file_name: string;
  file_size_bytes: number;
  checksum_sha256?: string;
  notes?: string;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUIRED' | 'ACCEPTED';
  submitted_at: string;
  ai_declaration_id?: string;
  ai_usage_level?: 'NONE' | 'API_ONLY' | 'EXTENSIVE' | 'LIMITED';
  tools_used?: any[];
  declaration_text?: string;
  policy_flag?: boolean;
  policy_notes?: string;
  supervisor_attested?: boolean;
}

export interface EvaluationStage {
  id: string;
  code: string;
  name: string;
  weightage_percent: number;
  sort_order: number;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  active_rubric_id?: string;
}

export interface RubricCriterion {
  id: string;
  rubric_id: string;
  name: string;
  description?: string;
  max_marks: number;
  weightage: number;
  sort_order: number;
}

export interface Rubric {
  id: string;
  evaluation_stage_id: string;
  stage_code: string;
  stage_name: string;
  stage_weight: number;
  name: string;
  criteria: RubricCriterion[];
}

export interface Evaluation {
  id: string;
  group_id: string;
  group_code: string;
  group_title: string;
  stage_id: string;
  stage_code: string;
  stage_name: string;
  stage_weight: number;
  scheduled_at?: string;
  venue?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'SCORED' | 'MODERATED' | 'PUBLISHED';
  panel?: Array<{
    evaluator_id: string;
    full_name: string;
    email: string;
    designation?: string;
    panel_role: 'INTERNAL' | 'EXTERNAL' | 'CHAIR';
  }>;
  rubric?: Rubric;
}

export interface ScoreSummary {
  evaluation_id: string;
  status: string;
  panel_size: number;
  submitted_sheets: number;
  aggregation_method: string;
  raw_aggregate_percent: number;
  final_percent: number;
  criterion_summary: Array<{
    criterion_id: string;
    criterion_name: string;
    max_marks: number;
    weightage: number;
    mean_points: number;
    weighted_score: number;
  }>;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  notif_type: string;
  related_entity_type?: string;
  related_entity_id?: string;
  is_read: boolean;
  created_at: string;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  audience_roles: string[];
  publisher_name: string;
  session_name?: string;
  published_at: string;
}

export interface AuditLogItem {
  id: string;
  actor_id?: string;
  actor_name?: string;
  actor_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  created_at: string;
}
