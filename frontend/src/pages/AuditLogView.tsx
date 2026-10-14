import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, Filter } from 'lucide-react';
import { api } from '../api/client';
import { AuditLogItem } from '../types';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actionFilter, setActionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter]);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditLogs({ action: actionFilter || undefined });
      setLogs(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredLogs = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.action.toLowerCase().includes(s) ||
           l.entity_type.toLowerCase().includes(s) ||
           (l.actor_name && l.actor_name.toLowerCase().includes(s));
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Immutable Audit Trail &amp; Governance Ledger</h1>
          <p className="page-subtitle">
            Cryptographically timestamped, append-only records of all academic decisions, state transitions, and evaluations
          </p>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              className="form-input"
              placeholder="Search by action, actor, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            {['', 'CREATE_GROUP', 'SUBMIT_PROPOSAL', 'REVIEW_PROPOSAL', 'SUBMIT_DELIVERABLE', 'SUBMIT_EVALUATION_SCORE', 'PUBLISH_EVALUATION_RESULT'].map(act => (
              <button
                key={act}
                onClick={() => setActionFilter(act)}
                className={`btn btn-sm ${actionFilter === act ? 'btn-primary' : 'btn-secondary'}`}
              >
                {act ? act.replace(/_/g, ' ') : 'All Actions'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AUDIT LOG TABLE */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Academic Actor</th>
                <th>Action Code</th>
                <th>Target Entity</th>
                <th>Audit Context / Recorded Values</th>
                <th>IP Mask</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748B' }}>
                    No audit records matching criteria.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748B' }}>
                      {new Date(l.created_at).toISOString().replace('T', ' ').substring(0, 19)}
                    </td>
                    <td style={{ fontWeight: 600, color: '#0E2A47' }}>
                      {l.actor_name || 'System Actor'}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontFamily: 'monospace', fontSize: '11px' }}>
                        {l.action}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#334155', fontWeight: 600 }}>{l.entity_type}</span>
                      {l.entity_id && (
                        <span style={{ fontSize: '10.5px', color: '#94A3B8', display: 'block', fontFamily: 'monospace' }}>
                          {l.entity_id.substring(0, 8)}...
                        </span>
                      )}
                    </td>
                    <td style={{ maxWidth: '340px', fontSize: '11.5px', fontFamily: 'monospace', color: '#334155' }}>
                      {l.new_values ? JSON.stringify(l.new_values) : <span style={{ color: '#94A3B8' }}>None</span>}
                    </td>
                    <td style={{ fontSize: '11px', color: '#64748B' }}>
                      {l.ip_address || '127.0.0.1'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
