import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Users,
  FileText,
  UserCheck,
  CalendarCheck,
  FolderArchive,
  Award,
  BarChart3,
  ShieldCheck,
  UserCog
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { activeRole } = useAuth();

  const isStudent = activeRole === 'STUDENT';
  const isSupervisor = activeRole === 'SUPERVISOR' || activeRole === 'CO_SUPERVISOR';
  const isEvaluator = activeRole === 'INTERNAL_EVALUATOR' || activeRole === 'EXTERNAL_EXAMINER';
  const isGovernance = activeRole === 'FYP_COORDINATOR' || activeRole === 'HOD' || activeRole === 'SUPER_ADMIN';

  // Role-scoped navigation definition
  const allNavItems = [
    {
      id: 'dashboard',
      label: isStudent ? 'Student Dashboard' : isSupervisor ? 'Supervisor Console' : isEvaluator ? 'Assessor Console' : 'Executive Overview',
      icon: LayoutDashboard,
      section: 'Core',
      visible: true
    },
    {
      id: 'groups',
      label: isStudent ? 'My Group & Team' : isSupervisor ? 'Assigned Groups' : 'Project Groups',
      icon: Users,
      section: 'Academic',
      visible: !isEvaluator
    },
    {
      id: 'proposals',
      label: isStudent ? 'Project Proposal' : isSupervisor ? 'Proposal Reviews' : isEvaluator ? 'Candidate Proposals' : 'Proposal Workflow',
      icon: FileText,
      section: 'Academic',
      visible: true
    },
    {
      id: 'project-types',
      label: '10 Project Pathways',
      icon: Compass,
      section: 'Academic',
      visible: true
    },
    {
      id: 'supervision',
      label: 'Supervision & Load',
      icon: UserCheck,
      section: 'Mentorship',
      visible: isGovernance
    },
    {
      id: 'meetings',
      label: isStudent ? 'Meetings & 300h Logbook' : isSupervisor ? 'Meetings & Sign-off' : 'Supervisory Meetings',
      icon: CalendarCheck,
      section: 'Mentorship',
      visible: isStudent || isSupervisor || isGovernance
    },
    {
      id: 'deliverables',
      label: isStudent ? 'Deliverables & AI Policy' : isSupervisor ? 'Deliverable Reviews' : isEvaluator ? 'Candidate Evidence' : 'Deliverables & AI Policy',
      icon: FolderArchive,
      section: 'Evidence',
      visible: true
    },
    {
      id: 'evaluations',
      label: isEvaluator ? 'Defense Scoring Console' : 'Evaluations & Rubrics',
      icon: Award,
      section: 'Assessment',
      visible: isEvaluator || isGovernance || isSupervisor
    },
    {
      id: 'reports',
      label: 'Reports & At-Risk Radar',
      icon: BarChart3,
      section: 'Governance',
      visible: isGovernance
    },
    {
      id: 'audit',
      label: 'Audit Trail & Compliance',
      icon: ShieldCheck,
      section: 'Governance',
      visible: isGovernance
    },
    {
      id: 'users-admin',
      label: 'User Roster & CSV Import',
      icon: UserCog,
      section: 'Administration',
      visible: isGovernance
    }
  ];

  const visibleItems = allNavItems.filter(item => item.visible);
  const sections = Array.from(new Set(visibleItems.map(item => item.section)));

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/rsci-logo.png" alt="RSCI Seal" className="sidebar-logo" />
        <div className="sidebar-brand">
          <span className="sidebar-brand-title">RSCI FYP Portal</span>
          <span className="sidebar-brand-subtitle">Computing &amp; Innovation</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => (
          <React.Fragment key={section}>
            <div className="nav-section-title">{section}</div>
            {visibleItems
              .filter(item => item.section === section)
              .map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => onSelectTab(item.id)}
                    type="button"
                  >
                    <Icon className="nav-item-icon" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
          </React.Fragment>
        ))}
      </nav>
    </aside>
  );
};
