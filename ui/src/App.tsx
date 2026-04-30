import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';
import { Dashboard } from './pages/Dashboard';
import { ChatPage } from './pages/ChatPage';
import { AgentsPage } from './pages/AgentsPage';
import { WorkflowsPage } from './pages/WorkflowsPage';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { Skills } from './pages/Skills';
import { Settings } from './pages/Settings';
import { CompanyFeed } from './pages/CompanyFeed';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const company = localStorage.getItem('company');
  return company ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="main-content">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Onboarding */}
      <Route
        path="/onboarding"
        element={
          <PrivateRoute>
            <Onboarding />
          </PrivateRoute>
        }
      />

      {/* App principal */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <RequireOnboarding>
              <AppLayout>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/chat/:agentId" element={<ChatPage />} />
                  <Route path="/agents" element={<AgentsPage />} />
                  <Route path="/workflows" element={<WorkflowsPage />} />
                  <Route path="/feed" element={<CompanyFeed />} />
                  <Route path="/integrations" element={<IntegrationsPage />} />
                  <Route path="/skills" element={<Skills />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </AppLayout>
            </RequireOnboarding>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
