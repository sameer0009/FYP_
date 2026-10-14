import React, { useState, useEffect } from 'react';
import {
  Award,
  Calendar,
  CheckCircle2,
  Lock,
  Plus,
  Sliders,
  TrendingUp,
  X,
  FileCheck
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { EvaluationStage, Rubric, ProjectGroup, ScoreSummary } from '../types';

export const EvaluationsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [stages, setStages] = useState<EvaluationStage[]>([]);
  const [rubrics, setRubrics] = useState<Rubric[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [selectedStageId, setSelectedStageId] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [activeTab, setActiveTab] = useState<'stages' | 'rubrics' | 'scoring'>('stages');
  const [scoringModal, setScoringModal] = useState<{
    groupId: string;
    groupCode: string;
    groupTitle: string;
    stageId: string;
    stageName: string;
    evaluationId?: string;
  } | null>(null);

  const [activeRubric, setActiveRubric] = useState<Rubric | null>(null);
  const [criterionScores, setCriterionScores] = useState<{ [critId: string]: number }>({});
  const [evaluatorComments, setEvaluatorComments] = useState('');
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user, activeRole]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const sessions = await api.getSessions();
      const activeSession = sessions?.find(s => s.is_active) || sessions?.[0];
      if (activeSession) {
        const [stgData, rubData, grpData] = await Promise.all([
          api.getEvaluationStages(activeSession.id),
          api.getRubrics(),
          api.getGroups()
        ]);
        setStages(stgData || []);
        setRubrics(rubData || []);
        setGroups(grpData || []);
        if (stgData && stgData.length > 0) setSelectedStageId(stgData[0].id);
        if (grpData && grpData.length > 0) setSelectedGroupId(grpData[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenScoring = async (group: ProjectGroup, stage: EvaluationStage) => {
    try {
      // Find or schedule evaluation
      let evalRecord;
      try {
        evalRecord = await api.scheduleEvaluation({
          group_id: group.id,
          stage_id: stage.id,
          scheduled_at: new Date().toISOString()
        });
      } catch (err: any) {
        // already exists, get by ID or proceed
      }

      // Load active rubric for this stage
      const rubric = rubrics.find(r => r.evaluation_stage_id === stage.id) || rubrics[0];
      setActiveRubric(rubric);

      // Initialize default scores
      const initial: { [id: string]: number } = {};
      rubric.criteria.forEach(c => {
        initial[c.id] = Math.round(c.max_marks * 0.85); // 85% default
      });
      setCriterionScores(initial);

      setScoringModal({
        groupId: group.id,
        groupCode: group.group_code,
        groupTitle: group.title,
        stageId: stage.id,
        stageName: stage.name,
        evaluationId: evalRecord?.id
      });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const calculateCurrentWeightedTotal = () => {
    if (!activeRubric) return 0;
    let total = 0;
    activeRubric.criteria.forEach(c => {
      const score = criterionScores[c.id] || 0;
      total += (score / c.max_marks) * c.weightage;
    });
    return Math.round(total * 100) / 100;
  };

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scoringModal || !activeRubric) return;

    const payload = {
      criteria_scores: activeRubric.criteria.map(c => ({
        criterion_id: c.id,
        marks_obtained: criterionScores[c.id] || 0,
        comments: 'Evaluated according to standard criteria descriptor.'
      })),
      comments: evaluatorComments || 'Strong technical demonstration and comprehensive documentation.'
    };

    try {
      // Create/ensure evaluation exists
      const res = await api.scheduleEvaluation({
        group_id: scoringModal.groupId,
        stage_id: scoringModal.stageId
      }).catch(() => null);

      const targetEvalId = res?.id || scoringModal.evaluationId;
      if (targetEvalId) {
        await api.submitScore(targetEvalId, payload);
        const summary = await api.getScoreSummary(targetEvalId);
        setScoreSummary(summary);
      }

      setMessage({ text: 'Evaluation score sheet submitted and aggregated', isError: false });
      setScoringModal(null);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handlePublishGrade = async (evalId: string) => {
    try {
      await api.publishEvaluation(evalId);
      setMessage({ text: 'Evaluation results officially published to students', isError: false });
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const isCoordinator = activeRole === 'FYP_COORDINATOR' || activeRole === 'HOD' || activeRole === 'SUPER_ADMIN';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Evaluations, Rubrics &amp; Defense Grading</h1>
          <p className="page-subtitle">
            5 Formal Evaluation Stages (E1–E5), weighted criterion scoring, and moderated grade publication
          </p>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px', borderRadius: '6px', marginBottom: '16px',
          background: message.isError ? '#FEF2F2' : '#ECFDF5',
          color: message.isError ? '#991B1B' : '#065F46',
          border: `1px solid ${message.isError ? '#FECACA' : '#A7F3D0'}`,
          fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* TABS */}
      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === 'stages' ? 'active' : ''}`}
          onClick={() => setActiveTab('stages')}
        >
          Evaluation Stages (E1–E5)
        </button>
        <button
          className={`tab-btn ${activeTab === 'rubrics' ? 'active' : ''}`}
          onClick={() => setActiveTab('rubrics')}
        >
          Scoring Rubrics &amp; Criteria
        </button>
        <button
          className={`tab-btn ${activeTab === 'scoring' ? 'active' : ''}`}
          onClick={() => setActiveTab('scoring')}
        >
          Defense Scoring Console
        </button>
      </div>

      {/* TAB 1: EVALUATION STAGES */}
      {activeTab === 'stages' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Stage Code</th>
                  <th>Evaluation Milestone</th>
                  <th>Framework Weightage</th>
                  <th>Purpose &amp; Scope</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stages.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0E2A47' }}>{s.code}</td>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{s.name}</td>
                    <td>
                      <span className="badge badge-info" style={{ fontWeight: 700 }}>
                        {s.weightage_percent}% Weight
                      </span>
                    </td>
                    <td style={{ fontSize: '12.5px', color: '#475569' }}>
                      {s.code === 'E1' && 'Initial proposal defense, problem viability, and scope validation'}
                      {s.code === 'E2' && 'Mid-term progress, architectural depth, and SRS/SDD documentation'}
                      {s.code === 'E3' && 'Year-long supervisor continuous discipline and effort verification'}
                      {s.code === 'E4' && 'Final live system demonstration, functional completeness, and testing'}
                      {s.code === 'E5' && 'Comprehensive final thesis report and individual oral viva defense'}
                    </td>
                    <td>
                      <span className="badge badge-success">{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: RUBRICS */}
      {activeTab === 'rubrics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {rubrics.map(r => (
            <div key={r.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{r.name}</h3>
                  <span style={{ fontSize: '12px', color: '#64748B' }}>
                    {r.stage_code} ({r.stage_name}) · {r.stage_weight}% Total Contribution
                  </span>
                </div>
                <span className="badge badge-neutral">Active Rubric Baseline</span>
              </div>

              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Criterion</th>
                      <th>Max Marks</th>
                      <th>Relative Weight</th>
                      <th>Performance Guidance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.criteria?.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                        <td style={{ fontWeight: 700, color: '#0E2A47' }}>{c.max_marks} pts</td>
                        <td>{c.weightage}%</td>
                        <td style={{ fontSize: '12px', color: '#64748B' }}>
                          Standard 5-band rubric descriptor (Excellent, Good, Satisfactory, Needs Improvement)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: DEFENSE SCORING CONSOLE */}
      {activeTab === 'scoring' && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Project Groups Ready for Panel Assessment</h2>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Group Code</th>
                  <th>Project Title</th>
                  <th>Pathway</th>
                  <th>Conduct Assessment</th>
                </tr>
              </thead>
              <tbody>
                {groups.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0E2A47' }}>{g.group_code}</td>
                    <td style={{ fontWeight: 600 }}>{g.title}</td>
                    <td><span className="badge badge-neutral">{g.project_type_name}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {stages.map(stg => (
                          <button
                            key={stg.id}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenScoring(g, stg)}
                          >
                            Score {stg.code}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCORING MODAL */}
      {scoringModal && activeRubric && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>
                  {scoringModal.groupCode} · {scoringModal.stageName}
                </span>
                <h3 className="card-title" style={{ marginTop: '2px' }}>{scoringModal.groupTitle}</h3>
              </div>
              <button onClick={() => setScoringModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitScore}>
              <div className="modal-body">
                {/* LIVE AGGREGATE GAUGE */}
                <div style={{
                  background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px',
                  borderRadius: '8px', marginBottom: '20px', display: 'flex',
                  justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                      Calculated Normalized Score:
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: 800, color: '#0E2A47', fontFamily: 'var(--font-display)' }}>
                      {calculateCurrentWeightedTotal()}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge badge-info">
                      {activeRubric.stage_weight}% Contribution to Final Degree Grade
                    </span>
                  </div>
                </div>

                {/* CRITERIA INPUTS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                  {activeRubric.criteria.map(c => {
                    const currentScore = criterionScores[c.id] || 0;
                    return (
                      <div key={c.id} style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>{c.name} ({c.weightage}%)</span>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#2563EB' }}>
                            {currentScore} / {c.max_marks} Points
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max={c.max_marks}
                          step="1"
                          value={currentScore}
                          onChange={(e) => setCriterionScores({
                            ...criterionScores,
                            [c.id]: parseFloat(e.target.value)
                          })}
                          style={{ width: '100%', accentColor: '#0E2A47' }}
                        />
                      </div>
                    );
                  })}
                </div>

                <div className="form-group">
                  <label className="form-label">Evaluator Qualitative Remarks &amp; Feedback *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Enter formal justification for panel assessment..."
                    value={evaluatorComments}
                    onChange={(e) => setEvaluatorComments(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setScoringModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Lock &amp; Submit Score Sheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
