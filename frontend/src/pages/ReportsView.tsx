import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  AlertTriangle,
  Download,
  Users,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export const ReportsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [atRiskGroups, setAtRiskGroups] = useState<any[]>([]);
  const [supervisorLoad, setSupervisorLoad] = useState<any[]>([]);
  const [evalProgress, setEvalProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const [risk, load, prog] = await Promise.all([
        api.getAtRiskGroupsReport().catch(() => []),
        api.getSupervisorLoadReport().catch(() => []),
        api.getEvaluationProgressReport().catch(() => [])
      ]);
      setAtRiskGroups(risk || []);
      setSupervisorLoad(load || []);
      setEvalProgress(prog || []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = () => {
    window.open('/api/v1/reports/groups-summary?format=csv', '_blank');
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Reports &amp; At-Risk Radar</h1>
          <p className="page-subtitle">
            Academic governance analytics, supervisor load balancing, and milestone risk detection
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleExportCSV}>
          <FileSpreadsheet size={16} /> Export Official CSV Roster
        </button>
      </div>

      {/* AT-RISK GROUPS RADAR */}
      <div className="card" style={{ borderLeft: '4px solid #DC2626', marginBottom: '24px' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} color="#DC2626" />
            <h2 className="card-title" style={{ margin: 0 }}>
              At-Risk Exception Radar ({atRiskGroups.length} Groups Flagged)
            </h2>
          </div>
          <span className="badge badge-danger">High Governance Priority</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px' }}>
          Groups are flagged based on three automated triggers: unallocated supervisor, proposal revision/rejection loops, or logged student effort below 18 cumulative hours.
        </p>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group Code</th>
                <th>Project Title</th>
                <th>Pathway</th>
                <th>Total Effort Hours</th>
                <th>Identified Risk Factors</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {atRiskGroups.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#059669' }}>
                    <CheckCircle2 size={18} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                    Zero groups currently flagged. All active cohorts satisfy baseline indicators.
                  </td>
                </tr>
              ) : (
                atRiskGroups.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0E2A47' }}>{g.group_code}</td>
                    <td style={{ fontWeight: 600 }}>{g.title}</td>
                    <td><span className="badge badge-neutral">{g.project_type_name}</span></td>
                    <td style={{ fontWeight: 700, color: g.total_hours < 18 ? '#DC2626' : '#0F172A' }}>
                      {g.total_hours} / 300 hrs
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {g.risk_flags?.map((rf: string, i: number) => (
                          <span key={i} className="badge badge-warning" style={{ fontSize: '10.5px' }}>
                            {rf.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={g.severity === 'HIGH' ? 'badge badge-danger' : 'badge badge-warning'}>
                        {g.severity}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUPERVISOR LOAD DISTRIBUTION */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Supervisor Capacity &amp; Allocation Distribution</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty Member</th>
                <th>Designation</th>
                <th>Active Supervision Load</th>
                <th>Capacity Utilization</th>
                <th>Policy Compliance</th>
              </tr>
            </thead>
            <tbody>
              {supervisorLoad.map(f => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.full_name}</td>
                  <td>{f.designation}</td>
                  <td>{f.active_groups_count} of 6 Groups</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="progress-track" style={{ width: '120px', height: '6px' }}>
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(100, f.utilization_percent)}%`,
                            background: f.utilization_percent >= 100 ? '#DC2626' : '#2563EB'
                          }}
                        ></div>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{f.utilization_percent}%</span>
                    </div>
                  </td>
                  <td>
                    {f.active_groups_count <= f.max_supervision_load ? (
                      <span className="badge badge-success">Compliant (≤ 6 Groups)</span>
                    ) : (
                      <span className="badge badge-danger">Cap Exceeded</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* EVALUATION PROGRESS */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Evaluation Completion by Milestone Stage</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {evalProgress.map(ep => (
            <div key={ep.id} style={{ background: '#F8FAFC', padding: '16px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, color: '#0E2A47' }}>{ep.code}</span>
                <span className="badge badge-info">{ep.weightage_percent}%</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '8px' }}>
                {ep.name}
              </div>
              <div className="progress-track" style={{ height: '6px', marginBottom: '6px' }}>
                <div className="progress-fill" style={{ width: `${ep.progress_percent}%` }}></div>
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748B' }}>
                {ep.completed_evaluations} / {ep.total_evaluations} Groups Evaluated
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
