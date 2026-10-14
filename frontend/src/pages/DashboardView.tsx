import React, { useState, useEffect } from 'react';
import {
  Users,
  Compass,
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Megaphone,
  TrendingUp,
  Award,
  ArrowRight,
  UserCheck,
  CalendarCheck,
  FolderArchive,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { AnnouncementItem, ProjectGroup } from '../types';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user, activeRole } = useAuth();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [atRiskList, setAtRiskList] = useState<any[]>([]);
  const [effortSummary, setEffortSummary] = useState<any>(null);
  const [supervisorLoad, setSupervisorLoad] = useState<any[]>([]);
  const [evalProgress, setEvalProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, [user, activeRole]);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [annData, grpData, riskData, loadData, progData] = await Promise.all([
        api.getAnnouncements().catch(() => []),
        api.getGroups().catch(() => []),
        api.getAtRiskGroupsReport().catch(() => []),
        api.getSupervisorLoadReport().catch(() => []),
        api.getEvaluationProgressReport().catch(() => [])
      ]);
      setAnnouncements(annData || []);
      setGroups(grpData || []);
      setAtRiskList(riskData || []);
      setSupervisorLoad(loadData || []);
      setEvalProgress(progData || []);

      if (grpData && grpData.length > 0) {
        const effort = await api.getEffortSummary(grpData[0].id).catch(() => null);
        setEffortSummary(effort);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isStudent = activeRole === 'STUDENT';
  const isSupervisor = activeRole === 'SUPERVISOR' || activeRole === 'CO_SUPERVISOR';
  const isEvaluator = activeRole === 'INTERNAL_EVALUATOR' || activeRole === 'EXTERNAL_EXAMINER';
  const isGovernance = activeRole === 'FYP_COORDINATOR' || activeRole === 'HOD' || activeRole === 'SUPER_ADMIN';

  // Compute pathway breakdown for analytics
  const pathwayCounts: { [key: string]: number } = {};
  groups.forEach(g => {
    const name = g.project_type_name || 'Product Development Project';
    pathwayCounts[name] = (pathwayCounts[name] || 0) + 1;
  });

  return (
    <div className="page-container">
      {/* ========================================================= */}
      {/* 1. STUDENT PERSONALIZED DASHBOARD                         */}
      {/* ========================================================= */}
      {isStudent && (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Candidate Project Dashboard</h1>
              <p className="page-subtitle">
                Academic Session Fall 2026 · Group {groups[0]?.group_code || 'FYP-F26-001'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => onNavigate('meetings')}>
                <Clock size={15} /> Log Work Hours
              </button>
              <button className="btn btn-primary" onClick={() => onNavigate('deliverables')}>
                <FolderArchive size={15} /> Submit Deliverable
              </button>
            </div>
          </div>

          {/* PROJECT STATUS BANNER */}
          <div className="card" style={{ borderLeft: '4px solid #0E2A47', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' }}>
                  {groups[0]?.group_code || 'FYP-F26-001'}
                </span>
                <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#0A192F', marginTop: '2px' }}>
                  {groups[0]?.title || 'Autonomous Edge Computing Platform for Industrial Telemetry'}
                </h2>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span className="badge badge-neutral">
                    {groups[0]?.project_type_name || 'Product Development Project'}
                  </span>
                  <span className="badge badge-success">Proposal Approved</span>
                  <span className="badge badge-info">
                    Supervisor: {groups[0]?.supervisor_name || 'Dr. Tariq Mahmood'}
                  </span>
                </div>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('groups')}>
                Manage Team Members
              </button>
            </div>
          </div>

          {/* 300-HOUR EFFORT ANALYTICS & WEEKLY PACING */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title">300-Hour Effort Progress Meter</h3>
                <span className="badge badge-info">Target: 300.0 Hours</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', color: '#64748B' }}>Cumulative Verified Hours</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: '#0E2A47', fontFamily: 'var(--font-display)' }}>
                  {effortSummary ? effortSummary.total_hours : 25.0} / 300 hrs ({effortSummary ? effortSummary.progress_percent : 8.3}%)
                </span>
              </div>
              <div className="progress-track" style={{ height: '12px', marginBottom: '12px' }}>
                <div
                  className="progress-fill"
                  style={{
                    width: `${effortSummary ? Math.max(5, effortSummary.progress_percent) : 8.3}%`,
                    background: '#0E2A47'
                  }}
                ></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px', background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                <div>
                  <span style={{ color: '#64748B' }}>Faculty Verified:</span>
                  <div style={{ fontWeight: 700, color: '#059669' }}>
                    {effortSummary ? effortSummary.verified_hours : 25.0} hrs
                  </div>
                </div>
                <div>
                  <span style={{ color: '#64748B' }}>Pending Verification:</span>
                  <div style={{ fontWeight: 700, color: '#D97706' }}>
                    {effortSummary ? effortSummary.total_hours - effortSummary.verified_hours : 0} hrs
                  </div>
                </div>
              </div>
            </div>

            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title">Weekly Pace &amp; Target Pacing</h3>
                <span className="badge badge-success">Pacing Normal</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: '#EFF6FF', border: '3px solid #2563EB',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '16px', fontWeight: 800, color: '#1D4ED8', lineHeight: 1 }}>9.0</span>
                  <span style={{ fontSize: '9px', color: '#64748B' }}>hrs/wk</span>
                </div>
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0A192F' }}>
                    Mandatory Academic Velocity
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                    RSCI Framework v1.0 mandates 9 verified hours per week per student team across 32 academic weeks.
                  </p>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12.5px', color: '#475569' }}>Last Supervisor Advisory Session:</span>
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#059669' }}>Signed Off</span>
              </div>
            </div>
          </div>

          {/* UPCOMING MILESTONE CHECKPOINTS */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div className="card-header">
              <h3 className="card-title">Academic Milestones &amp; Scheduled Defenses</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('deliverables')}>
                Full Deliverables Matrix
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Milestone 1 · Completed</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Proposal Defense</div>
                <span className="badge badge-success" style={{ marginTop: '8px' }}>Approved</span>
              </div>
              <div style={{ padding: '12px', background: '#EFF6FF', borderRadius: '6px', border: '1px solid #BFDBFE' }}>
                <div style={{ fontSize: '11px', color: '#1D4ED8', fontWeight: 600 }}>Milestone 2 · Active Focus</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>SRS &amp; SDD Architecture</div>
                <span className="badge badge-info" style={{ marginTop: '8px' }}>Due Dec 15, 2026</span>
              </div>
              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Milestone 3</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Mid-Term Defense (20%)</div>
                <span className="badge badge-neutral" style={{ marginTop: '8px' }}>Feb 28, 2027</span>
              </div>
              <div style={{ padding: '12px', background: '#F8FAFC', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Milestone 4 &amp; 5</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginTop: '2px' }}>Demo &amp; Viva Voce (60%)</div>
                <span className="badge badge-neutral" style={{ marginTop: '8px' }}>Jun 2027</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* 2. SUPERVISOR PERSONALIZED DASHBOARD                      */}
      {/* ========================================================= */}
      {isSupervisor && (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Faculty Supervision Console</h1>
              <p className="page-subtitle">
                Supervisory Workload, Advisory Sessions, and Continuous Academic Assessment
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('meetings')}>
              <CalendarCheck size={16} /> Schedule Advisory Session
            </button>
          </div>

          {/* SUPERVISOR METRICS & CAPACITY GAUGE */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-box blue">
                <Users size={22} />
              </div>
              <div>
                <div className="metric-value">1 / 6</div>
                <div className="metric-label">Allocated Groups (Max 6)</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box green">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="metric-value">1</div>
                <div className="metric-label">Signed Meeting Minutes</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box amber">
                <Clock size={22} />
              </div>
              <div>
                <div className="metric-value">3</div>
                <div className="metric-label">Verified Effort Logs</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box">
                <Award size={22} />
              </div>
              <div>
                <div className="metric-value">E3 Active</div>
                <div className="metric-label">Continuous Supervisor Evaluation</div>
              </div>
            </div>
          </div>

          {/* SUPERVISOR ASSIGNED COHORTS */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">My Assigned Final Year Project Cohorts</h2>
              <span className="badge badge-success">5 Slots Available</span>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Group Code</th>
                    <th>Project Working Title</th>
                    <th>Pathway Category</th>
                    <th>Cumulative Effort</th>
                    <th>Pacing Health</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.slice(0, 3).map(g => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0E2A47' }}>{g.group_code}</td>
                      <td style={{ fontWeight: 600 }}>{g.title}</td>
                      <td><span className="badge badge-neutral">{g.project_type_name}</span></td>
                      <td style={{ fontWeight: 700 }}>25.0 / 300 hrs</td>
                      <td><span className="badge badge-success">On Pace (9h/wk)</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('meetings')}>
                            Meetings
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('deliverables')}>
                            Deliverables
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* 3. EVALUATOR PERSONALIZED DASHBOARD                       */}
      {/* ========================================================= */}
      {isEvaluator && (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Assessor Defense Console</h1>
              <p className="page-subtitle">
                Examination Panels, Oral Defenses, and Rubric Scoring
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('evaluations')}>
              <Award size={16} /> Open Scoring Console
            </button>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-box blue">
                <CalendarCheck size={22} />
              </div>
              <div>
                <div className="metric-value">1</div>
                <div className="metric-label">Defense Panels Assigned</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box green">
                <ShieldCheck size={22} />
              </div>
              <div>
                <div className="metric-value">E1 – E5</div>
                <div className="metric-label">Weighted Rubric Standards</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box amber">
                <FileText size={22} />
              </div>
              <div>
                <div className="metric-value">Ready</div>
                <div className="metric-label">Candidate Dossier Verified</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Scheduled Defense Sessions</h2>
            </div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th>Candidate Group</th>
                    <th>Pathway</th>
                    <th>Scheduled Date &amp; Venue</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {groups.slice(0, 1).map(g => (
                    <tr key={g.id}>
                      <td><span className="badge badge-info">E1: Proposal Defense</span></td>
                      <td style={{ fontWeight: 600 }}>{g.group_code} — {g.title}</td>
                      <td>{g.project_type_name}</td>
                      <td>Faculty Auditorium · Session Active</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => onNavigate('evaluations')}>
                          Score Candidate Rubric
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* 4. COORDINATOR & HOD EXECUTIVE ANALYTICS DASHBOARD        */}
      {/* ========================================================= */}
      {isGovernance && (
        <>
          <div className="page-header">
            <div>
              <h1 className="page-title">Executive Academic Governance &amp; Analytics</h1>
              <p className="page-subtitle">
                Departmental cohort oversight, pathway distribution, supervision capacity, and at-risk monitoring
              </p>
            </div>
            <button className="btn btn-primary" onClick={() => onNavigate('reports')}>
              <BarChart3 size={16} /> Export Governance Reports
            </button>
          </div>

          {/* HIGH-LEVEL METRICS */}
          <div className="metrics-grid">
            <div className="metric-card">
              <div className="metric-icon-box blue">
                <Users size={22} />
              </div>
              <div>
                <div className="metric-value">{groups.length}</div>
                <div className="metric-label">Total Registered Groups</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box green">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="metric-value">
                  {groups.filter(g => g.status === 'APPROVED' || g.status === 'IN_PROGRESS').length}
                </div>
                <div className="metric-label">Active Approved Projects</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box">
                <UserCheck size={22} />
              </div>
              <div>
                <div className="metric-value">
                  {supervisorLoad.length > 0 ? `${supervisorLoad.reduce((a, b) => a + b.active_groups_count, 0)} Allocated` : '1 Allocated'}
                </div>
                <div className="metric-label">Supervisor Allocations</div>
              </div>
            </div>

            <div className="metric-card">
              <div className="metric-icon-box amber">
                <AlertTriangle size={22} />
              </div>
              <div>
                <div className="metric-value">{atRiskList.length}</div>
                <div className="metric-label">Flagged At-Risk Exceptions</div>
              </div>
            </div>
          </div>

          {/* ANALYTICS SECTION: PATHWAY DISTRIBUTION & EVALUATION VELOCITY */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* PATHWAY DISTRIBUTION */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title">10 Computing Pathways Cohort Breakdown</h3>
                <span className="badge badge-neutral">Fall 2026</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { name: 'Product Development', count: 1, percent: 35, color: '#0E2A47' },
                  { name: 'Entrepreneurial Project', count: 0, percent: 15, color: '#D4AF37' },
                  { name: 'Continuation Project', count: 0, percent: 10, color: '#2563EB' },
                  { name: 'Research Project', count: 0, percent: 20, color: '#059669' },
                  { name: 'IoT & Embedded Systems', count: 0, percent: 10, color: '#7C3AED' },
                  { name: 'Consulting Tracks (AI, Cyber, Cloud, Digital)', count: 0, percent: 10, color: '#475569' }
                ].map((item, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600, color: '#1E293B' }}>{item.name}</span>
                      <span style={{ color: '#64748B', fontFamily: 'monospace' }}>{item.percent}%</span>
                    </div>
                    <div className="progress-track" style={{ height: '7px' }}>
                      <div className="progress-fill" style={{ width: `${item.percent}%`, background: item.color }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* EVALUATION PROGRESS & LIFECYCLE STAGES */}
            <div className="card" style={{ margin: 0 }}>
              <div className="card-header">
                <h3 className="card-title">Evaluation Stage Velocity (E1–E5)</h3>
                <span className="badge badge-info">100% Total Scale</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {evalProgress.map(s => (
                  <div key={s.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '3px' }}>
                      <span style={{ fontWeight: 600, color: '#0E2A47' }}>
                        {s.code}: {s.name} ({s.weightage_percent}%)
                      </span>
                      <span style={{ fontWeight: 700, color: '#2563EB' }}>
                        {s.progress_percent}%
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: '7px' }}>
                      <div className="progress-fill" style={{ width: `${s.progress_percent}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* AT-RISK COHORTS DRILL-DOWN RADAR */}
          <div className="card" style={{ borderLeft: '4px solid #DC2626', marginBottom: '24px' }}>
            <div className="card-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} color="#DC2626" />
                <h3 className="card-title" style={{ margin: 0 }}>
                  Active At-Risk Exception Radar ({atRiskList.length})
                </h3>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('reports')}>
                View Full Audit
              </button>
            </div>
            {atRiskList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px', color: '#059669', fontSize: '13px' }}>
                <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                All active project groups satisfy the milestone pacing and supervisor allocation benchmarks.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Group Code</th>
                      <th>Project Title</th>
                      <th>Total Verified Effort</th>
                      <th>Flagged Risk Factors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {atRiskList.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{r.group_code}</td>
                        <td>{r.title}</td>
                        <td>{r.total_hours} hrs</td>
                        <td>
                          {r.risk_flags?.map((f: string, i: number) => (
                            <span key={i} className="badge badge-danger" style={{ fontSize: '10.5px', marginRight: '4px' }}>
                              {f}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* INSTITUTIONAL ANNOUNCEMENTS                               */}
      {/* ========================================================= */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Megaphone size={18} color="#0E2A47" />
            <h2 className="card-title" style={{ margin: 0 }}>Official Institutional Notices</h2>
          </div>
        </div>
        {announcements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: '#64748B', fontSize: '13px' }}>
            No active announcements.
          </div>
        ) : (
          announcements.map((ann) => (
            <div
              key={ann.id}
              style={{
                padding: '16px 0',
                borderBottom: '1px solid #F1F5F9'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <h3 style={{ fontSize: '15px', color: '#0A192F', fontWeight: 700 }}>{ann.title}</h3>
                <span style={{ fontSize: '12px', color: '#64748B' }}>
                  {new Date(ann.published_at).toLocaleDateString()}
                </span>
              </div>
              <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: '1.6' }}>{ann.body}</p>
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                {ann.audience_roles?.map((role, idx) => (
                  <span key={idx} className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                    {role}
                  </span>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
