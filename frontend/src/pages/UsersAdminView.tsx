import React, { useState, useEffect } from 'react';
import { UserPlus, Upload, Search, Check, X, UserX, FileSpreadsheet } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { User } from '../types';

export const UsersAdminView: React.FC = () => {
  const { user, activeRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<any | null>(null);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // New user form state
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role_name: 'STUDENT',
    phone: '',
    designation: ''
  });

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers({ role: roleFilter || undefined });
      setUsers(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser(newUser);
      setMessage({ text: `User ${newUser.full_name} created successfully`, isError: false });
      setShowCreateModal(false);
      setNewUser({ email: '', full_name: '', role_name: 'STUDENT', phone: '', designation: '' });
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvFile) return;

    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      const res = await api.bulkImportUsers(formData);
      setImportSummary(res);
      setMessage({
        text: `Bulk import completed: ${res.imported_count} imported, ${res.rejected_count} rejected`,
        isError: false
      });
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const handleToggleActive = async (targetUser: User) => {
    try {
      await api.setUserActive(targetUser.id, !targetUser.is_active);
      setMessage({ text: `User status updated`, isError: false });
      loadUsers();
    } catch (err: any) {
      setMessage({ text: err.message, isError: true });
    }
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const s = search.toLowerCase();
    return u.full_name.toLowerCase().includes(s) || u.email.toLowerCase().includes(s);
  });

  const roles = [
    '', 'SUPER_ADMIN', 'FYP_COORDINATOR', 'HOD', 'SUPERVISOR', 'CO_SUPERVISOR',
    'STUDENT', 'INTERNAL_EVALUATOR', 'EXTERNAL_EXAMINER', 'INDUSTRY_PARTNER'
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Roster &amp; CSV Bulk Provisioning</h1>
          <p className="page-subtitle">
            Manage student, faculty, and examiner identities, session-scoped roles, and roster imports
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            <FileSpreadsheet size={16} /> Bulk Import CSV
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus size={16} /> Add Single User
          </button>
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

      {/* FILTER CONTROLS */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              className="form-input"
              placeholder="Search by user name or institutional email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {['', 'STUDENT', 'SUPERVISOR', 'INTERNAL_EVALUATOR', 'FYP_COORDINATOR'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`btn btn-sm ${roleFilter === r ? 'btn-primary' : 'btn-secondary'}`}
              >
                {r ? r.replace(/_/g, ' ') : 'All Roles'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* USERS ROSTER TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Institutional Email</th>
                <th>Assigned Roles</th>
                <th>Academic Designation</th>
                <th>Account Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600, color: '#0F172A' }}>{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {u.roles?.map((r, i) => (
                          <span key={i} className="badge badge-info" style={{ fontSize: '10.5px' }}>
                            {r}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{u.designation || 'Student / General'}</td>
                    <td>
                      {u.is_active ? (
                        <span className="badge badge-success">Active</span>
                      ) : (
                        <span className="badge badge-danger">Deactivated</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={`btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-success'}`}
                        onClick={() => handleToggleActive(u)}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Provision New Academic User</h3>
              <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dr. Haris Bilal"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Verified Institutional Email *</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="e.g. h.bilal@rsci.edu.pk"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Assigned Role *</label>
                    <select
                      className="form-select"
                      value={newUser.role_name}
                      onChange={(e) => setNewUser({ ...newUser, role_name: e.target.value })}
                      required
                    >
                      {roles.filter(Boolean).map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+92 300 1234567"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    />
                  </div>
                </div>

                {newUser.role_name !== 'STUDENT' && (
                  <div className="form-group">
                    <label className="form-label">Academic Designation</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Assistant Professor / Lead Architect"
                      value={newUser.designation}
                      onChange={(e) => setNewUser({ ...newUser, designation: e.target.value })}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV BULK IMPORT MODAL */}
      {showImportModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="card-title">Bulk Provision Roster from CSV (FR-UM-05)</h3>
              <button onClick={() => setShowImportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleBulkImport}>
              <div className="modal-body">
                <p style={{ fontSize: '13px', color: '#475569', marginBottom: '16px' }}>
                  Upload a standard UTF-8 CSV file with headers: <code>institutional_id, email, full_name, role</code>. Optional: <code>designation, phone</code>.
                </p>

                <div className="form-group">
                  <label className="form-label">Select CSV Roster File *</label>
                  <input
                    type="file"
                    accept=".csv"
                    className="form-input"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                {importSummary && (
                  <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '6px', fontSize: '12.5px', marginTop: '16px' }}>
                    <div style={{ fontWeight: 700, color: '#0E2A47', marginBottom: '6px' }}>
                      Import Job Summary:
                    </div>
                    <div>• Total Records Parsed: {importSummary.total_rows}</div>
                    <div style={{ color: '#059669', fontWeight: 600 }}>• Successfully Provisioned: {importSummary.imported_count}</div>
                    {importSummary.rejected_count > 0 && (
                      <div style={{ color: '#DC2626', fontWeight: 600, marginTop: '6px' }}>
                        • Rejected Records: {importSummary.rejected_count}
                        <ul style={{ paddingLeft: '18px', marginTop: '4px', fontSize: '11.5px', color: '#991B1B' }}>
                          {importSummary.errors.slice(0, 5).map((err: any, i: number) => (
                            <li key={i}>Row {err.row} ({err.email}): {err.error}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                  Close
                </button>
                <button type="submit" className="btn btn-primary">
                  Process &amp; Commit Roster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
