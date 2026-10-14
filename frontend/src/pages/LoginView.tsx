import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginView: React.FC = () => {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email.trim().toLowerCase(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid institutional credentials');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0A192F 0%, #0E2A47 50%, #163E66 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px'
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        background: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
        overflow: 'hidden'
      }}>
        {/* HEADER BRAND */}
        <div style={{ padding: '36px 32px 24px 32px', textAlign: 'center', borderBottom: '1px solid #F1F5F9' }}>
          <img
            src="/rsci-logo.png"
            alt="RSCI Logo"
            style={{ width: '96px', height: '96px', margin: '0 auto 16px auto', display: 'block', objectFit: 'contain', filter: 'drop-shadow(0 4px 12px rgba(10, 25, 47, 0.12))' }}
          />
          <h1 style={{ fontSize: '21px', fontWeight: 800, color: '#0A192F', letterSpacing: '-0.02em' }}>
            RSCI FYP Portal
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
            Riphah School of Computing &amp; Innovation
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#EFF6FF', padding: '3px 10px', borderRadius: '9999px', marginTop: '10px' }}>
            <ShieldCheck size={13} color="#2563EB" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#1E40AF' }}>
              Academic Session Fall 2026
            </span>
          </div>
        </div>

        {/* LOGIN FORM */}
        <div style={{ padding: '28px 32px 36px 32px' }}>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', color: '#991B1B',
              padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px', marginBottom: '18px'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Verified Institutional Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@rsci.edu.pk or student@students.rsci.edu.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '14px', fontWeight: 700 }}
              disabled={isLoading}
            >
              {isLoading ? 'Authenticating Credentials...' : 'Sign In to Portal'}
            </button>
          </form>

          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11.5px', color: '#94A3B8' }}>
            RSCI FYP Governance Framework v1.0 · Protected by RBAC &amp; Audit Trail
          </div>
        </div>
      </div>
    </div>
  );
};
