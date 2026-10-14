import React, { useState, useEffect } from 'react';
import { Compass, ShieldCheck, CheckCircle2, Search, Filter } from 'lucide-react';
import { api } from '../api/client';
import { ProjectType } from '../types';

export const ProjectTypesView: React.FC = () => {
  const [types, setTypes] = useState<ProjectType[]>([]);
  const [search, setSearch] = useState('');
  const [selectedProgram, setSelectedProgram] = useState('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTypes();
  }, []);

  const loadTypes = async () => {
    setIsLoading(true);
    try {
      const data = await api.getProjectTypes();
      setTypes(data || []);
    } finally {
      setIsLoading(false);
    }
  };

  const programs = ['ALL', 'CS', 'SE', 'IT', 'AI', 'DS', 'CY', 'CGV'];

  const filteredTypes = types.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                          t.description.toLowerCase().includes(search.toLowerCase()) ||
                          t.code.toLowerCase().includes(search.toLowerCase());
    const matchesProgram = selectedProgram === 'ALL' || t.suitable_programs.includes(selectedProgram);
    return matchesSearch && matchesProgram;
  });

  const getPolicyBadge = (policy: string) => {
    switch (policy) {
      case 'NO_AI':
        return <span className="badge badge-danger">Strict AI Restriction (APIs Only)</span>;
      case 'EXTENSIVE_ALLOWED':
        return <span className="badge badge-success">Extensive AI Allowed</span>;
      case 'LIMITED':
        return <span className="badge badge-warning">Limited AI (Docs Prohibited)</span>;
      default:
        return <span className="badge badge-info">{policy}</span>;
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Multi-Domain Project Catalogue</h1>
          <p className="page-subtitle">
            Ten official Final Year Project pathways defined under RSCI FYP Framework v1.0
          </p>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="card" style={{ padding: '14px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
            <Search size={16} color="#64748B" />
            <input
              type="text"
              className="form-input"
              placeholder="Search project types, description, outcomes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Filter by Program:</span>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {programs.map(prog => (
                <button
                  key={prog}
                  onClick={() => setSelectedProgram(prog)}
                  className={`btn btn-sm ${selectedProgram === prog ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {prog}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* PROJECT TYPE CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        {filteredTypes.map((pt, idx) => (
          <div key={pt.id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '6px',
                  background: '#0E2A47', color: '#FFF', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px'
                }}>
                  {idx + 1}
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', color: '#0A192F', fontWeight: 700 }}>{pt.name}</h3>
                  <span style={{ fontSize: '11px', color: '#64748B', fontFamily: 'monospace' }}>{pt.code}</span>
                </div>
              </div>
              {getPolicyBadge(pt.ai_policy)}
            </div>

            <p style={{ fontSize: '13px', color: '#334155', lineHeight: '1.6', marginBottom: '16px', flex: '1' }}>
              {pt.description}
            </p>

            <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '12px', marginTop: 'auto' }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748B' }}>
                  Eligible Programs:
                </span>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                  {pt.suitable_programs.map(prog => (
                    <span key={prog} className="badge badge-neutral" style={{ fontSize: '11px' }}>
                      BS {prog}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '6px', marginTop: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <ShieldCheck size={14} color="#059669" />
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#0F172A' }}>AI Policy Specification</span>
                </div>
                <p style={{ fontSize: '11.5px', color: '#475569', lineHeight: '1.4' }}>
                  {pt.ai_policy_notes || 'No generic generative AI allowed in final report documentation.'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
