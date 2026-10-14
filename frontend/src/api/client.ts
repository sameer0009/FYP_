const API_BASE = '/api/v1';

export class ApiError extends Error {
  code: string;
  details?: any;

  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('rsci_token');
  const activeRole = localStorage.getItem('rsci_active_role');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (activeRole) {
    headers['X-Active-Role'] = activeRole;
  }

  // Handle FormData vs JSON
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || (json && json.success === false)) {
    const code = json?.error?.code || `HTTP_${response.status}`;
    const msg = json?.error?.message || response.statusText || 'Request failed';
    throw new ApiError(code, msg, json?.error?.details);
  }

  return json.data as T;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request<any>('/auth/me'),
  logout: () => request<any>('/auth/logout', { method: 'POST' }),

  // Academic
  getSessions: () => request<any[]>('/sessions'),
  createSession: (data: any) => request<any>('/sessions', { method: 'POST', body: JSON.stringify(data) }),
  activateSession: (id: string) => request<any>(`/sessions/${id}/activate`, { method: 'POST' }),
  getSessionCalendar: (id: string) => request<any[]>(`/sessions/${id}/calendar`),
  getProjectTypes: () => request<any[]>('/project-types'),
  getProjectType: (id: string) => request<any>(`/project-types/${id}`),

  // Users
  getUsers: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/users${qs ? `?${qs}` : ''}`);
  },
  createUser: (data: any) => request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
  bulkImportUsers: (formData: FormData) => request<any>('/users/bulk-import', { method: 'POST', body: formData }),
  setUserActive: (id: string, is_active: boolean) =>
    request<any>(`/users/${id}/activate`, { method: 'PATCH', body: JSON.stringify({ is_active }) }),

  // Groups
  getGroups: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/groups${qs ? `?${qs}` : ''}`);
  },
  getGroup: (id: string) => request<any>(`/groups/${id}`),
  createGroup: (data: any) => request<any>('/groups', { method: 'POST', body: JSON.stringify(data) }),
  addGroupMember: (groupId: string, email: string) =>
    request<any>(`/groups/${groupId}/members`, { method: 'POST', body: JSON.stringify({ email }) }),
  updateGroupStatus: (groupId: string, status: string) =>
    request<any>(`/groups/${groupId}/status`, { method: 'POST', body: JSON.stringify({ status }) }),

  // Proposals
  getProposal: (id: string) => request<any>(`/proposals/${id}`),
  updateProposal: (id: string, data: any) => request<any>(`/proposals/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  submitProposal: (id: string) => request<any>(`/proposals/${id}/submit`, { method: 'POST' }),
  reviewProposal: (id: string, data: any) => request<any>(`/proposals/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }),
  getProposalQueue: (status?: string) => request<any[]>(`/proposals${status ? `?status=${status}` : ''}`),

  // Supervision
  getFaculty: () => request<any[]>('/faculty'),
  getAllocations: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/allocations${qs ? `?${qs}` : ''}`);
  },
  createAllocation: (data: any) => request<any>('/allocations', { method: 'POST', body: JSON.stringify(data) }),
  reassignSupervisor: (id: string, data: any) => request<any>(`/allocations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Meetings & Logbook
  getGroupMeetings: (groupId: string) => request<any[]>(`/groups/${groupId}/meetings`),
  scheduleMeeting: (groupId: string, data: any) => request<any>(`/groups/${groupId}/meetings`, { method: 'POST', body: JSON.stringify(data) }),
  recordAttendance: (meetingId: string, entries: any[]) =>
    request<any>(`/meetings/${meetingId}/attendance`, { method: 'POST', body: JSON.stringify({ entries }) }),
  saveMinutes: (meetingId: string, data: any) =>
    request<any>(`/meetings/${meetingId}/minutes`, { method: 'POST', body: JSON.stringify(data) }),
  signOffMinutes: (meetingId: string) => request<any>(`/meetings/${meetingId}/sign-off`, { method: 'POST' }),

  // Effort & Logbook (300h)
  getEffortSummary: (groupId: string) => request<any>(`/groups/${groupId}/effort-summary`),
  logEffort: (groupId: string, data: any) =>
    request<any>(`/groups/${groupId}/effort-entries`, { method: 'POST', body: JSON.stringify(data) }),
  verifyEffort: (entryId: string) => request<any>(`/effort-entries/${entryId}/verify`, { method: 'PATCH' }),

  // Deliverables & Checklist
  getDeliverableChecklist: (groupId: string) => request<any[]>(`/groups/${groupId}/deliverable-checklist`),
  getGroupSubmissions: (groupId: string) => request<any[]>(`/groups/${groupId}/submissions`),
  submitDeliverable: (groupId: string, formData: FormData) =>
    request<any>(`/groups/${groupId}/submissions`, { method: 'POST', body: formData }),
  reviewDeliverable: (submissionId: string, data: any) =>
    request<any>(`/submissions/${submissionId}/review`, { method: 'PATCH', body: JSON.stringify(data) }),
  attestAiDeclaration: (declarationId: string) =>
    request<any>(`/ai-declarations/${declarationId}/attest`, { method: 'PATCH' }),

  // Evaluations & Rubrics
  getEvaluationStages: (sessionId: string) => request<any[]>(`/sessions/${sessionId}/evaluation-stages`),
  getRubrics: (stageId?: string) => request<any[]>(`/rubrics${stageId ? `?stage_id=${stageId}` : ''}`),
  getRubric: (id: string) => request<any>(`/rubrics/${id}`),
  scheduleEvaluation: (data: any) => request<any>('/evaluations', { method: 'POST', body: JSON.stringify(data) }),
  getEvaluation: (id: string) => request<any>(`/evaluations/${id}`),
  assignPanel: (evaluationId: string, members: any[]) =>
    request<any>(`/evaluations/${evaluationId}/panels`, { method: 'POST', body: JSON.stringify({ members }) }),
  submitScore: (evaluationId: string, data: any) =>
    request<any>(`/evaluations/${evaluationId}/scores`, { method: 'POST', body: JSON.stringify(data) }),
  getScoreSummary: (evaluationId: string) => request<any>(`/evaluations/${evaluationId}/score-summary`),
  publishEvaluation: (evaluationId: string) => request<any>(`/evaluations/${evaluationId}/publish`, { method: 'PATCH' }),
  getGroupResults: (groupId: string) => request<any[]>(`/groups/${groupId}/results`),

  // Reports
  getGroupsSummaryReport: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/reports/groups-summary${qs ? `?${qs}` : ''}`);
  },
  getAtRiskGroupsReport: () => request<any[]>('/reports/at-risk-groups'),
  getSupervisorLoadReport: () => request<any[]>('/reports/supervisor-load'),
  getEvaluationProgressReport: () => request<any[]>('/reports/evaluation-progress'),

  // Notifications & Announcements
  getNotifications: () => request<any[]>('/notifications'),
  markNotificationRead: (id: string) => request<any>(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request<any>('/notifications/read-all', { method: 'POST' }),
  getAnnouncements: () => request<any[]>('/announcements'),
  publishAnnouncement: (data: any) => request<any>('/announcements', { method: 'POST', body: JSON.stringify(data) }),

  // Audit Logs
  getAuditLogs: (params: Record<string, any> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<any[]>(`/audit-logs${qs ? `?${qs}` : ''}`);
  }
};
