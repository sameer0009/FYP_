import React, { useState, useEffect } from 'react';
import {
  FolderArchive,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  FileText,
  FileCode,
  Download,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ProjectGroup, DeliverableTemplate, DeliverableSubmission } from '../types';

export const DeliverablesView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [checklist, setChecklist] = useState<DeliverableTemplate[]>([]);
  const [submissions, setSubmissions] = useState<DeliverableSubmission[]>([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadNotes, setUploadNotes] = useState('');
  const [aiUsageLevel, setAiUsageLevel] = useState<'NONE' | 'API_ONLY' | 'EXTENSIVE' | 'LIMITED'>('NONE');
  const [aiDeclarationText, setAiDeclarationText] = useState('No generative AI assistance was used in this document.');
  const [reviewModal, setReviewModal] = useState<{ submissionId: string; title: string } | null>(null);
  const [reviewDecision, setReviewDecision] = useState<'ACCEPTED' | 'REVISION_REQUIRED'>('ACCEPTED');
  const [reviewComments, setReviewComments] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, [user, activeRole]);

  useEffect(() => {
    if (selectedGroupId) {
      loadDeliverables(selectedGroupId);
    }
  }, [selectedGroupId]);

  const loadGroups = async () => {
    setIsLoading(true);
    try {
      const data = await api.getGroups();
      setGroups(data || []);
      if (data && data.length > 0) {
        setSelectedGroupId(data[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeliverables = async (groupId: string) => {
    try {
      const [chk, subs] = await Promise.all([
        api.getDeliverableChecklist(groupId).catch(() => []),
        api.getGroupSubmissions(groupId).catch(() => [])
      ]);
      setChecklist(chk || []);
      setSubmissions(subs || []);
      if (chk && chk.length > 0 && !selectedTemplateId) {
        setSelectedTemplateId(chk[0].id);
      }
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedTemplateId || !uploadFile) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('template_id', selectedTemplateId);
    formData.append('notes', uploadNotes);
    formData.append('ai_usage_level', aiUsageLevel);
    formData.append('declaration_text', aiDeclarationText);

    try {
      const res = await api.submitDeliverable(selectedGroupId, formData);
      setMessage({
        text: `Deliverable uploaded successfully (SHA-256: ${res.checksum_sha256.substring(0, 12)}...)`,
        isError: false
      });
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadNotes('');
      loadDeliverables(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal || !reviewComments.trim()) return;

    try {
      await api.reviewDeliverable(reviewModal.submissionId, {
        decision: reviewDecision,
        comments: reviewComments.trim()
      });
      setMessage({ text: `Submission marked as ${reviewDecision}`, isError: false });
      setReviewModal(null);
      setReviewComments('');
      loadDeliverables(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleAttestAi = async (declarationId: string) => {
    try {
      await api.attestAiDeclaration(declarationId);
      setMessage({ text: 'AI declaration attested by supervisor', isError: false });
      loadDeliverables(selectedGroupId);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const isSupervisor = activeRole === 'SUPERVISOR' || activeRole === 'CO_SUPERVISOR' || activeRole === 'FYP_COORDINATOR';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Deliverables, Evidence &amp; AI Compliance</h1>
          <p className="page-subtitle">
            15 Common Framework Obligations, type-specific artifacts, and AI-usage disclosure
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowUploadModal(true)}>
          <Upload size={16} /> Submit Deliverable &amp; AI Declaration
        </button>
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

      {/* ACTIVE GROUP SELECTOR */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label className="form-label" style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>
            Active Group Context:
          </label>
          <select
            className="form-select"
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            style={{ maxWidth: '400px' }}
          >
            {groups.map(g => (
              <option key={g.id} value={g.id}>
                {g.group_code} — {g.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* DELIVERABLE CHECKLIST */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h2 className="card-title">Required Project Checklist &amp; Milestone Schedule</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Milestone Checkpoint</th>
                <th>Deliverable Artifact Title</th>
                <th>Due Date</th>
                <th>Submissions</th>
                <th>Review Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {checklist.map(item => (
                <tr key={item.id}>
                  <td>
                    <span className="badge badge-neutral">{item.milestone_title}</span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#0F172A' }}>{item.title}</td>
                  <td>{item.milestone_due_date}</td>
                  <td>{item.submission_count} uploads</td>
                  <td>
                    {item.latest_status === 'ACCEPTED' ? (
                      <span className="badge badge-success">Accepted</span>
                    ) : item.latest_status === 'REVISION_REQUIRED' ? (
                      <span className="badge badge-danger">Revision Required</span>
                    ) : item.latest_status === 'SUBMITTED' ? (
                      <span className="badge badge-info">Submitted</span>
                    ) : (
                      <span className="badge badge-neutral">Pending</span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setSelectedTemplateId(item.id);
                        setShowUploadModal(true);
                      }}
                    >
                      <Upload size={12} /> Upload
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SUBMISSION EVIDENCE HISTORY & AI DECLARATIONS */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Versioned Submissions &amp; AI Compliance Audit</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Artifact</th>
                <th>Ver</th>
                <th>File / Checksum</th>
                <th>AI Usage Tier</th>
                <th>Compliance Status</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {submissions.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    No file submissions uploaded yet.
                  </td>
                </tr>
              ) : (
                submissions.map(sub => (
                  <tr key={sub.id}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{sub.deliverable_title}</td>
                    <td>
                      <span className="badge badge-neutral">v{sub.version}</span>
                    </td>
                    <td>
                      <a
                        href={sub.file_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Download size={13} /> {sub.file_name}
                      </a>
                      <div style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#94A3B8', marginTop: '2px' }}>
                        SHA-256: {sub.checksum_sha256?.substring(0, 16)}...
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-info">{sub.ai_usage_level}</span>
                    </td>
                    <td>
                      {sub.policy_flag ? (
                        <span className="badge badge-danger">
                          <AlertTriangle size={12} /> Policy Mismatch
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          <ShieldCheck size={12} /> Compliant
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={sub.status === 'ACCEPTED' ? 'badge badge-success' : 'badge badge-warning'}>
                        {sub.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {isSupervisor && sub.status !== 'ACCEPTED' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setReviewModal({ submissionId: sub.id, title: sub.deliverable_title })}
                          >
                            Review
                          </button>
                        )}
                        {isSupervisor && sub.ai_declaration_id && !sub.supervisor_attested && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAttestAi(sub.ai_declaration_id!)}
                            title="Attest student AI declaration"
                          >
                            Attest AI
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* UPLOAD & AI DECLARATION MODAL */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Upload Project Deliverable &amp; AI Declaration</h3>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Checklist Item *</label>
                  <select
                    className="form-select"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    required
                  >
                    {checklist.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.milestone_title}: {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Document File (PDF, DOCX, ZIP up to 100MB) *</label>
                  <input
                    type="file"
                    className="form-input"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Submission Notes</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Revised after supervisor feedback on chapter 3..."
                    value={uploadNotes}
                    onChange={(e) => setUploadNotes(e.target.value)}
                  />
                </div>

                {/* MANDATORY AI DECLARATION FORM (SRS M11) */}
                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '16px', borderRadius: '8px', marginTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <ShieldCheck size={18} color="#0E2A47" />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0E2A47' }}>
                      Mandatory AI-Usage Compliance Declaration
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '12px' }}>
                    Pursuant to the RSCI FYP Framework, all students must declare generative AI involvement.
                  </p>

                  <div className="form-group">
                    <label className="form-label">AI Assistance Level *</label>
                    <select
                      className="form-select"
                      value={aiUsageLevel}
                      onChange={(e: any) => {
                        const lvl = e.target.value;
                        setAiUsageLevel(lvl);
                        if (lvl === 'NONE') {
                          setAiDeclarationText('No generative AI assistance was used in this document.');
                        } else if (lvl === 'API_ONLY') {
                          setAiDeclarationText('AI was incorporated solely through programmatic API integrations within the application runtime.');
                        } else if (lvl === 'EXTENSIVE') {
                          setAiDeclarationText('Generative AI was used for iterative prototyping and market validation, fully verified and attested by team.');
                        } else {
                          setAiDeclarationText('Limited generative AI was utilized for grammar checking and syntax verification only.');
                        }
                      }}
                    >
                      <option value="NONE">Level 0: No Generative AI Used</option>
                      <option value="API_ONLY">Level 1: API / Runtime Feature Only (Permitted)</option>
                      <option value="LIMITED">Level 2: Limited Assistance (Syntax / Grammar)</option>
                      <option value="EXTENSIVE">Level 3: Extensive AI Use (Entrepreneurial Pathway)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Student Attestation Statement *</label>
                    <textarea
                      className="form-textarea"
                      rows={2}
                      value={aiDeclarationText}
                      onChange={(e) => setAiDeclarationText(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Upload Deliverable
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUPERVISOR REVIEW MODAL */}
      {reviewModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Review Submission: {reviewModal.title}</h3>
              <button onClick={() => setReviewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReviewSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Decision *</label>
                  <select
                    className="form-select"
                    value={reviewDecision}
                    onChange={(e: any) => setReviewDecision(e.target.value)}
                  >
                    <option value="ACCEPTED">Accept Deliverable</option>
                    <option value="REVISION_REQUIRED">Return for Resubmission</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Academic Feedback *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Provide detailed feedback on requirements alignment and technical rigor..."
                    value={reviewComments}
                    onChange={(e) => setReviewComments(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReviewModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
