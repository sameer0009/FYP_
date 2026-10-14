import React, { useState, useEffect } from 'react';
import { FileText, CheckCircle2, AlertCircle, Clock, Send, MessageSquare, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Proposal, ProjectGroup } from '../types';

export const ProposalsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [proposals, setProposals] = useState<any[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [reviewDecision, setReviewDecision] = useState<'APPROVED' | 'REJECTED' | 'RESUBMISSION_REQUIRED'>('APPROVED');
  const [reviewComments, setReviewComments] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProposals();
  }, [user, activeRole]);

  const loadProposals = async () => {
    setIsLoading(true);
    try {
      const [props, grps] = await Promise.all([
        api.getProposalQueue(),
        api.getGroups()
      ]);
      setProposals(props || []);
      setGroups(grps || []);
      if (props && props.length > 0 && !selectedProposal) {
        loadProposalDetails(props[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadProposalDetails = async (id: string) => {
    try {
      const data = await api.getProposal(id);
      setSelectedProposal(data);
      setFormData({
        title: data.title || '',
        abstract: data.abstract || '',
        problem_statement: data.problem_statement || '',
        objectives: data.objectives || '',
        scope: data.scope || '',
        methodology: data.methodology || '',
        tools: data.tools || '',
        timeline_text: data.timeline_text || '',
        document_url: data.document_url || ''
      });
      setIsEditing(false);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposal) return;

    try {
      await api.updateProposal(selectedProposal.id, formData);
      setMessage({ text: 'Proposal draft saved successfully', isError: false });
      setIsEditing(false);
      loadProposalDetails(selectedProposal.id);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleSubmitProposal = async () => {
    if (!selectedProposal) return;
    try {
      await api.submitProposal(selectedProposal.id);
      setMessage({ text: 'Proposal officially submitted for supervisor review', isError: false });
      loadProposalDetails(selectedProposal.id);
      loadProposals();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleReviewProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProposal || !reviewComments.trim()) return;

    try {
      await api.reviewProposal(selectedProposal.id, {
        decision: reviewDecision,
        comments: reviewComments.trim()
      });
      setMessage({ text: `Review recorded: ${reviewDecision}`, isError: false });
      setReviewComments('');
      loadProposalDetails(selectedProposal.id);
      loadProposals();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'APPROVED': return <span className="badge badge-success">Approved Baseline</span>;
      case 'UNDER_SUPERVISOR_REVIEW': return <span className="badge badge-info">Under Supervisor Review</span>;
      case 'UNDER_COORDINATOR_REVIEW': return <span className="badge badge-warning">Under Coordinator Review</span>;
      case 'RESUBMISSION_REQUIRED': return <span className="badge badge-danger">Revision Required</span>;
      case 'REJECTED': return <span className="badge badge-danger">Rejected</span>;
      default: return <span className="badge badge-neutral">Draft</span>;
    }
  };

  const isReviewer = activeRole === 'SUPERVISOR' || activeRole === 'CO_SUPERVISOR' || activeRole === 'FYP_COORDINATOR' || activeRole === 'HOD';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Proposal Submission &amp; Approval Lifecycle</h1>
          <p className="page-subtitle">
            Formal multi-stage project definition, review comments, and baseline locking
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

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', alignItems: 'flex-start' }}>
        {/* PROPOSAL QUEUE LIST */}
        <div className="card" style={{ padding: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '12px', color: '#0E2A47' }}>
            Proposal Submissions ({proposals.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
            {proposals.map(p => (
              <div
                key={p.id}
                onClick={() => loadProposalDetails(p.id)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: selectedProposal?.id === p.id ? '2px solid #2563EB' : '1px solid #E2E8F0',
                  background: selectedProposal?.id === p.id ? '#EFF6FF' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#0E2A47' }}>
                    {p.group_code}
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#64748B' }}>v{p.version}</span>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', lineHeight: '1.3', marginBottom: '6px' }}>
                  {p.title || p.group_title}
                </div>
                <div>{getStatusBadge(p.status)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* PROPOSAL DETAILS & WORKFLOW ACTIONS */}
        {selectedProposal ? (
          <div>
            <div className="card">
              <div className="card-header">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>
                      {selectedProposal.group_code}
                    </span>
                    <span className="badge badge-neutral">Version {selectedProposal.version}</span>
                    {getStatusBadge(selectedProposal.status)}
                  </div>
                  <h2 className="card-title" style={{ marginTop: '6px', fontSize: '18px' }}>
                    {selectedProposal.title}
                  </h2>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {(selectedProposal.status === 'DRAFT' || selectedProposal.status === 'RESUBMISSION_REQUIRED') && (
                    <>
                      {!isEditing ? (
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>
                          Edit Proposal
                        </button>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>
                          Cancel
                        </button>
                      )}
                      <button className="btn btn-primary btn-sm" onClick={handleSubmitProposal}>
                        <Send size={14} /> Submit for Review
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* EDIT FORM OR VIEW */}
              {isEditing ? (
                <form onSubmit={handleSaveDraft}>
                  <div className="form-group">
                    <label className="form-label">Title *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Abstract *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={formData.abstract}
                      onChange={(e) => setFormData({ ...formData, abstract: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Problem Statement *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={formData.problem_statement}
                      onChange={(e) => setFormData({ ...formData, problem_statement: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Measurable Objectives *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={formData.objectives}
                      onChange={(e) => setFormData({ ...formData, objectives: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Scope &amp; Delimitations *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={formData.scope}
                      onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Methodology &amp; Architecture Plan *</label>
                    <textarea
                      className="form-textarea"
                      rows={3}
                      value={formData.methodology}
                      onChange={(e) => setFormData({ ...formData, methodology: e.target.value })}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="submit" className="btn btn-primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                      Abstract
                    </h4>
                    <p style={{ fontSize: '13.5px', color: '#1E293B', marginTop: '4px', lineHeight: '1.6' }}>
                      {selectedProposal.abstract || <span style={{ color: '#94A3B8' }}>Not provided yet.</span>}
                    </p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                      Problem Statement
                    </h4>
                    <p style={{ fontSize: '13.5px', color: '#1E293B', marginTop: '4px', lineHeight: '1.6' }}>
                      {selectedProposal.problem_statement || <span style={{ color: '#94A3B8' }}>Not provided yet.</span>}
                    </p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                      Measurable Objectives
                    </h4>
                    <p style={{ fontSize: '13.5px', color: '#1E293B', marginTop: '4px', lineHeight: '1.6' }}>
                      {selectedProposal.objectives || <span style={{ color: '#94A3B8' }}>Not provided yet.</span>}
                    </p>
                  </div>
                  <div>
                    <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#64748B', fontWeight: 700 }}>
                      Methodology &amp; Technology Stack
                    </h4>
                    <p style={{ fontSize: '13.5px', color: '#1E293B', marginTop: '4px', lineHeight: '1.6' }}>
                      {selectedProposal.methodology || <span style={{ color: '#94A3B8' }}>Not provided yet.</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* REVIEWER ACTIONS PANEL */}
            {isReviewer && selectedProposal.status !== 'APPROVED' && (
              <div className="card" style={{ borderLeft: '4px solid #1D4ED8' }}>
                <h3 className="card-title" style={{ marginBottom: '12px' }}>
                  Academic Review Decision
                </h3>
                <form onSubmit={handleReviewProposal}>
                  <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: '16px', marginBottom: '14px' }}>
                    <div className="form-group">
                      <label className="form-label">Review Decision *</label>
                      <select
                        className="form-select"
                        value={reviewDecision}
                        onChange={(e: any) => setReviewDecision(e.target.value)}
                      >
                        <option value="APPROVED">Approve Proposal</option>
                        <option value="RESUBMISSION_REQUIRED">Request Revisions</option>
                        <option value="REJECTED">Reject Proposal</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Reviewer Comments &amp; Required Conditions *</label>
                      <textarea
                        className="form-textarea"
                        rows={3}
                        placeholder="Provide concrete academic feedback and conditions..."
                        value={reviewComments}
                        onChange={(e) => setReviewComments(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn btn-primary">
                      Submit Review Decision
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* REVIEW HISTORY TIMELINE */}
            <div className="card">
              <h3 className="card-title" style={{ marginBottom: '14px' }}>
                Review History &amp; Decision Trail
              </h3>
              {(!selectedProposal.reviews || selectedProposal.reviews.length === 0) ? (
                <div style={{ padding: '16px', color: '#64748B', fontSize: '13px', textAlign: 'center' }}>
                  No reviews recorded on this proposal revision.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {selectedProposal.reviews.map(r => (
                    <div
                      key={r.id}
                      style={{
                        padding: '12px 16px',
                        borderRadius: '6px',
                        background: '#F8FAFC',
                        borderLeft: r.decision === 'APPROVED' ? '4px solid #059669' : '4px solid #DC2626'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, fontSize: '13px', color: '#0E2A47' }}>
                          {r.reviewer_name} ({r.stage})
                        </span>
                        <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div style={{ marginBottom: '6px' }}>{getStatusBadge(r.decision)}</div>
                      <p style={{ fontSize: '13px', color: '#334155' }}>{r.comments}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
            Select a proposal to view details.
          </div>
        )}
      </div>
    </div>
  );
};
