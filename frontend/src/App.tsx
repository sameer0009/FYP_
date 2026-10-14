import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './pages/DashboardView';
import { ProjectTypesView } from './pages/ProjectTypesView';
import { GroupsView } from './pages/GroupsView';
import { ProposalsView } from './pages/ProposalsView';
import { SupervisionView } from './pages/SupervisionView';
import { MeetingsView } from './pages/MeetingsView';
import { DeliverablesView } from './pages/DeliverablesView';
import { EvaluationsView } from './pages/EvaluationsView';
import { ReportsView } from './pages/ReportsView';
import { AuditLogView } from './pages/AuditLogView';
import { UsersAdminView } from './pages/UsersAdminView';
import { LoginView } from './pages/LoginView';
import './styles/index.css';

const MainApp: React.FC = () => {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');

  if (!user) {
    return <LoginView />;
  }

  return (
    <div className="app-shell">
      <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />
      <div className="main-content">
        <Header />
        <main>
          {currentTab === 'dashboard' && <DashboardView onNavigate={setCurrentTab} />}
          {currentTab === 'project-types' && <ProjectTypesView />}
          {currentTab === 'groups' && <GroupsView />}
          {currentTab === 'proposals' && <ProposalsView />}
          {currentTab === 'supervision' && <SupervisionView />}
          {currentTab === 'meetings' && <MeetingsView />}
          {currentTab === 'deliverables' && <DeliverablesView />}
          {currentTab === 'evaluations' && <EvaluationsView />}
          {currentTab === 'reports' && <ReportsView />}
          {currentTab === 'audit' && <AuditLogView />}
          {currentTab === 'users-admin' && <UsersAdminView />}
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};

export default App;
