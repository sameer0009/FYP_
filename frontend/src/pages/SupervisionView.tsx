import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, RefreshCw, X, ShieldAlert } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { SupervisionAllocation, ProjectGroup, User } from '../types';

export const SupervisionView: React.FC = () => {
  const { activeRole } = useAuth();
  const [faculty, setFaculty] = useState<any[]>([]);
  const [allocations, setAllocations] = useState<SupervisionAllocation[]>([]);
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [allocRole, setAllocRole] = useState<'SUPERVISOR' | 'CO_SUPERVISOR'>('SUPERVISOR');
  const [reassignModal, setReassignModal] = useState<{ allocationId: string; groupCode: string; supervisorName: string } | null>(null);
  const [newSupervisorId, setNewSupervisorId] = useState('');
  const [reassignReason, setReassignReason] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [fac, allocs, grps] = await Promise.all([
        api.getFaculty(),
        api.getAllocations(),
        api.getGroups()
      ]);
      setFaculty(fac || []);
      setAllocations(allocs || []);
      setGroups(grps || []);
      if (fac && fac.length > 0) setSelectedSupervisorId(fac[0].id);
      if (grps && grps.length > 0) setSelectedGroupId(grps[0].id);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroupId || !selectedSupervisorId) return;

    try {
      await api.createAllocation({
        group_id: selectedGroupId,
        supervisor_id: selectedSupervisorId,
        alloc_role: allocRole
      });
      setMessage({ text: 'Supervisor allocated successfully', isError: false });
      setShowAllocateModal(false);
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignModal || !newSupervisorId || !reassignReason.trim()) return;

    try {
      await api.reassignSupervisor(reassignModal.allocationId, {
        new_supervisor_id: newSupervisorId,
        reason: reassignReason.trim()
      });
      setMessage({ text: 'Supervisor reassigned successfully with audit record', isError: false });
      setReassignModal(null);
      setReassignReason('');
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const isCoordinator = activeRole === 'FYP_COORDINATOR' || activeRole === 'SUPER_ADMIN' || activeRole === 'HOD';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Supervisor Allocation &amp; Faculty Capacity</h1>
          <p className="page-subtitle">
            Mentorship distribution, expertise mapping, and strict load cap enforcement (Max 6 groups)
          </p>
        </div>
        {isCoordinator && (
          <button className="btn btn-primary" onClick={() => setShowAllocateModal(true)}>
            <Plus size={16} /> Allocate Supervisor
          </button>
        )}
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

      {/* FACULTY WORKLOAD MATRIX */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Faculty Mentorship Workload &amp; Specialization Directory</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Faculty Member</th>
                <th>Designation</th>
                <th>Domain Expertise</th>
                <th>Active Supervision Load</th>
                <th>Capacity Status</th>
              </tr>
            </thead>
            <tbody>
              {faculty.map(f => {
                const loadPercent = Math.round((f.current_load / f.max_supervision_load) * 100);
                const isFull = f.current_load >= f.max_supervision_load;
                return (
                  <tr key={f.id}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{f.full_name}</td>
                    <td>{f.designation}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {f.expertise_tags?.map((tag: string, i: number) => (
                          <span key={i} className="badge badge-neutral" style={{ fontSize: '10.5px' }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="progress-track" style={{ width: '100px', height: '6px' }}>
                          <div
                            className="progress-fill"
                            style={{
                              width: `${loadPercent}%`,
                              background: isFull ? '#DC2626' : '#2563EB'
                            }}
                          ></div>
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 600 }}>
                          {f.current_load} / {f.max_supervision_load} Groups
                        </span>
                      </div>
                    </td>
                    <td>
                      {isFull ? (
                        <span className="badge badge-danger">Capacity Full</span>
                      ) : (
                        <span className="badge badge-success">{f.available_capacity} Slots Available</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ACTIVE ALLOCATIONS LIST */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Current Active Project Allocations</h2>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group Code</th>
                <th>Project Title</th>
                <th>Supervisor</th>
                <th>Allocation Role</th>
                <th>Assigned Since</th>
                {isCoordinator && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>
                    No supervisor allocations recorded yet.
                  </td>
                </tr>
              ) : (
                allocations.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0E2A47' }}>
                      {a.group_code}
                    </td>
                    <td style={{ fontWeight: 600 }}>{a.group_title}</td>
                    <td>{a.supervisor_name}</td>
                    <td>
                      <span className="badge badge-info">{a.alloc_role}</span>
                    </td>
                    <td>{new Date(a.allocated_at).toLocaleDateString()}</td>
                    {isCoordinator && (
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setReassignModal({
                            allocationId: a.id,
                            groupCode: a.group_code,
                            supervisorName: a.supervisor_name
                          })}
                        >
                          <RefreshCw size={12} /> Reassign
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ALLOCATE SUPERVISOR MODAL */}
      {showAllocateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Allocate Project Supervisor</h3>
              <button onClick={() => setShowAllocateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateAllocation}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Group *</label>
                  <select
                    className="form-select"
                    value={selectedGroupId}
                    onChange={(e) => setSelectedGroupId(e.target.value)}
                    required
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.group_code} — {g.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Faculty Supervisor *</label>
                  <select
                    className="form-select"
                    value={selectedSupervisorId}
                    onChange={(e) => setSelectedSupervisorId(e.target.value)}
                    required
                  >
                    {faculty.map(f => (
                      <option key={f.id} value={f.id} disabled={f.current_load >= f.max_supervision_load}>
                        {f.full_name} ({f.current_load}/{f.max_supervision_load} groups) {f.current_load >= f.max_supervision_load ? '[FULL]' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Allocation Role *</label>
                  <select
                    className="form-select"
                    value={allocRole}
                    onChange={(e: any) => setAllocRole(e.target.value)}
                  >
                    <option value="SUPERVISOR">Primary Supervisor</option>
                    <option value="CO_SUPERVISOR">Co-Supervisor</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAllocateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Allocation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN SUPERVISOR MODAL */}
      {reassignModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Reassign Supervisor for {reassignModal.groupCode}</h3>
              <button onClick={() => setReassignModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleReassign}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '14px' }}>
                  Current Supervisor: <strong>{reassignModal.supervisorName}</strong>
                </p>

                <div className="form-group">
                  <label className="form-label">New Supervisor *</label>
                  <select
                    className="form-select"
                    value={newSupervisorId}
                    onChange={(e) => setNewSupervisorId(e.target.value)}
                    required
                  >
                    <option value="">Select faculty member...</option>
                    {faculty.map(f => (
                      <option key={f.id} value={f.id} disabled={f.current_load >= f.max_supervision_load}>
                        {f.full_name} ({f.current_load}/{f.max_supervision_load} groups)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Official Reassignment Reason *</label>
                  <textarea
                    className="form-textarea"
                    rows={3}
                    placeholder="Provide mandatory academic reason for reassignment..."
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setReassignModal(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Reassignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
