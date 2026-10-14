import React, { useState, useEffect } from 'react';
import { Bell, LogOut, CheckCheck, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import { NotificationItem } from '../types';

export const Header: React.FC = () => {
  const { user, activeRole, logout } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const loadNotifications = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data || []);
      setUnreadCount((data || []).filter(n => !n.is_read).length);
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const formatRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Admin';
      case 'FYP_COORDINATOR': return 'FYP Coordinator';
      case 'HOD': return 'Head of Department';
      case 'SUPERVISOR': return 'Supervisor';
      case 'CO_SUPERVISOR': return 'Co-Supervisor';
      case 'INTERNAL_EVALUATOR': return 'Internal Evaluator';
      case 'EXTERNAL_EXAMINER': return 'External Examiner';
      case 'INDUSTRY_PARTNER': return 'Industry Partner';
      case 'STUDENT': return 'Student Scholar';
      default: return role.replace(/_/g, ' ');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="session-pill">
          <span className="status-dot-active"></span>
          <span>Fall 2026 · Active Session</span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Notifications Menu */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ position: 'relative', padding: '7px 10px' }}
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#DC2626',
                  color: '#FFF',
                  fontSize: '10px',
                  fontWeight: 700,
                  borderRadius: '9999px',
                  padding: '1px 5px',
                  lineHeight: '1'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                width: '320px',
                background: '#FFFFFF',
                borderRadius: '8px',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                border: '1px solid #E2E8F0',
                zIndex: 100
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>
                  Notifications ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#2563EB',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <CheckCheck size={13} /> Mark all read
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                    No notifications
                  </div>
                ) : (
                  notifications.map(n => (
                    <div
                      key={n.id}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #F1F5F9',
                        background: n.is_read ? '#FFFFFF' : '#F8FAFC'
                      }}
                    >
                      <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#0F172A' }}>{n.title}</div>
                      <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '2px' }}>{n.body}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Identity Details & Role Badge */}
        <div className="user-profile-badge">
          <div className="user-avatar">
            {user?.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.full_name || 'Portal User'}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="badge badge-info" style={{ fontSize: '10px', padding: '1px 6px' }}>
                {formatRoleLabel(activeRole)}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '12px', padding: '6px 10px', gap: '6px' }}
            title="Sign out securely"
          >
            <LogOut size={14} />
            <span style={{ fontSize: '12px' }}>Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
