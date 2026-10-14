import React, { useState, useEffect } from 'react';
import { Users, Plus, Shield, Check, X, Search, UserPlus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ProjectGroup, ProjectType } from '../types';

export const GroupsView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [groups, setGroups] = useState<ProjectGroup[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectType[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ProjectGroup | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTypeId, setNewTypeId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [grps, types] = await Promise.all([
        api.getGroups(),
        api.getProjectTypes()
      ]);
      setGroups(grps || []);
      setProjectTypes(types || []);
      if (types && types.length > 0) {
        setNewTypeId(types[0].id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectGroup = async (group: ProjectGroup) => {
    try {
      const details = await api.getGroup(group.id);
      setSelectedGroup(details);
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newTypeId) return;

    try {
      await api.createGroup({ title: newTitle.trim(), project_type_id: newTypeId });
      setMessage({ text: 'Project group registered successfully', isError: false });
      setShowCreateModal(false);
      setNewTitle('');
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !inviteEmail.trim()) return;

    try {
      await api.addGroupMember(selectedGroup.id, inviteEmail.trim());
      setMessage({ text: 'Student added to project group', isError: false });
      setInviteEmail('');
      handleSelectGroup(selectedGroup);
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleStatusChange = async (groupId: string, newStatus: string) => {
    try {
      await api.updateGroupStatus(groupId, newStatus);
      setMessage({ text: `Group status changed to ${newStatus}`, isError: false });
      if (selectedGroup) {
        handleSelectGroup(selectedGroup);
      }
      loadData();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const filteredGroups = groups.filter(g => {
    const matchesSearch = g.title.toLowerCase().includes(search.toLowerCase()) ||
                          g.group_code.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'APPROVED': return <span className="badge badge-success">Approved</span>;
      case 'IN_PROGRESS': return <span className="badge badge-info">In Progress</span>;
      case 'FORMING': return <span className="badge badge-warning">Forming</span>;
      case 'PROPOSED': return <span className="badge badge-info">Proposed</span>;
      case 'EVALUATION': return <span className="badge badge-warning">In Evaluation</span>;
      case 'COMPLETED': return <span className="badge badge-success">Completed</span>;
      default: return <span className="badge badge-neutral">{st}</span>;
    }
  };

  const isCoordinator = activeRole === 'FYP_COORDINATOR' || activeRole === 'SUPER_ADMIN';

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Groups &amp; Teams</h1>
          <p className="page-subtitle">
            Group formation, student membership verification, and lifecycle progression
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} /> Register New FYP Group
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

      {/* FILTER CONTROLS */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              className="form-input"
              placeholder="Search by group code (e.g. FYP-F26-001) or title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['ALL', 'FORMING', 'PROPOSED', 'APPROVED', 'IN_PROGRESS'].map(st => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`btn btn-sm ${statusFilter === st ? 'btn-primary' : 'btn-secondary'}`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* GROUPS DATA TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Group Code</th>
                <th>Project Working Title</th>
                <th>Pathway Category</th>
                <th>Members</th>
                <th>Leader</th>
                <th>Supervisor</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredGroups.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#64748B' }}>
                    No groups registered matching current filter.
                  </td>
                </tr>
              ) : (
                filteredGroups.map(group => (
                  <tr key={group.id}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0E2A47' }}>
                      {group.group_code}
                    </td>
                    <td style={{ fontWeight: 600, color: '#0F172A', maxWidth: '300px' }}>
                      {group.title}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                        {group.project_type_name}
                      </span>
                    </td>
                    <td>{group.members_count || 1} / 4 Students</td>
                    <td>{group.leader_name || 'Leader'}</td>
                    <td>{group.supervisor_name || <span style={{ color: '#94A3B8' }}>Unallocated</span>}</td>
                    <td>{getStatusBadge(group.status)}</td>
                    <td>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleSelectGroup(group)}>
                        Manage Group
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GROUP DETAILS & MEMBERSHIP MODAL */}
      {selectedGroup && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#2563EB', fontWeight: 700 }}>
                  {selectedGroup.group_code}
                </span>
                <h3 className="card-title" style={{ marginTop: '2px' }}>{selectedGroup.title}</h3>
              </div>
              <button onClick={() => setSelectedGroup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Project Pathway</div>
                  <div style={{ fontWeight: 700, fontSize: '13px' }}>{selectedGroup.project_type_name}</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Current State</div>
                  <div style={{ marginTop: '2px' }}>{getStatusBadge(selectedGroup.status)}</div>
                </div>
                <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>Primary Supervisor</div>
                  <div style={{ fontWeight: 600, fontSize: '13px' }}>
                    {selectedGroup.supervisor?.full_name || 'Pending Allocation'}
                  </div>
                </div>
              </div>

              {/* MEMBERS ROSTER */}
              <h4 style={{ fontSize: '14px', marginBottom: '10px', color: '#0E2A47' }}>
                Group Members ({selectedGroup.members?.length || 0} / 4 limit)
              </h4>
              <div style={{ border: '1px solid #E2E8F0', borderRadius: '6px', overflow: 'hidden', marginBottom: '18px' }}>
                {selectedGroup.members?.map(m => (
                  <div key={m.user_id} style={{
                    padding: '10px 14px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', borderBottom: '1px solid #F1F5F9'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.full_name}</div>
                      <div style={{ fontSize: '11.5px', color: '#64748B' }}>{m.email}</div>
                    </div>
                    <span className={m.member_role === 'LEADER' ? 'badge badge-primary' : 'badge badge-neutral'}>
                      {m.member_role}
                    </span>
                  </div>
                ))}
              </div>

              {/* ADD MEMBER FORM */}
              {(selectedGroup.members?.length || 0) < 4 && (
                <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="Enter student institutional email..."
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-secondary" style={{ flexShrink: 0 }}>
                    <UserPlus size={14} /> Add Member
                  </button>
                </form>
              )}

              {/* COORDINATOR APPROVAL CONTROLS */}
              {isCoordinator && (
                <div style={{ background: '#FEFCE8', border: '1px solid #FEF08A', padding: '14px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#854D0E', marginBottom: '8px' }}>
                    Coordinator State Governance Actions:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedGroup.status === 'FORMING' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(selectedGroup.id, 'APPROVED')}>
                        Approve Group Registration
                      </button>
                    )}
                    {selectedGroup.status === 'APPROVED' && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleStatusChange(selectedGroup.id, 'IN_PROGRESS')}>
                        Transition to IN_PROGRESS
                      </button>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(selectedGroup.id, 'COMPLETED')}>
                      Mark Completed
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedGroup(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE GROUP MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Register New Final Year Project Group</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Project Working Title *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Autonomous Robotic Navigation using Edge AI"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Select Project Pathway Category (10 Types) *</label>
                  <select
                    className="form-select"
                    value={newTypeId}
                    onChange={(e) => setNewTypeId(e.target.value)}
                    required
                  >
                    {projectTypes.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '6px', fontSize: '12.5px', color: '#475569' }}>
                  <p>• Group Code will be assigned atomically: <strong>FYP-F26-00x</strong></p>
                  <p>• You will be registered as the initial <strong>LEADER</strong>.</p>
                  <p>• Allowed team size: <strong>2 to 4 students</strong>.</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
