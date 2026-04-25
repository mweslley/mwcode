import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { ModeSelect } from './pages/ModeSelect';
import { ChatSingle } from './pages/ChatSingle';
import { Dashboard } from './pages/Dashboard';
import { Agents } from './pages/Agents';
import { Hire } from './pages/Hire';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Onboarding } from './pages/Onboarding';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

function CheckOnboarding({ children }: { children: React.ReactNode }) {
  // Check if onboarding was done
  const company = localStorage.getItem('company');
  if (!company) {
    return <Onboarding />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <CheckOnboarding>
            <div className="app">
              <aside className="sidebar">
                <h1 className="logo">MWCode</h1>
                <nav>
                  <NavLink to="/" end>Início</NavLink>
                  <NavLink to="/single">Modo Pessoal</NavLink>
                  <hr />
                  <span className="section">Empresa</span>
                  <NavLink to="/dashboard">Painel</NavLink>
                  <NavLink to="/agentes">Agentes</NavLink>
                  <NavLink to="/contratar">Contratar</NavLink>
                  <NavLink to="/chat">Chat</NavLink>
                  <NavLink to="/config">Configurações</NavLink>
                  <hr />
                  <a href="/login" onClick={() => { localStorage.clear(); }}>Sair</a>
                </nav>
              </aside>

              <main className="content">
                <Routes>
                  <Route path="/" element={<ModeSelect />} />
                  <Route path="/single" element={<ChatSingle />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/agentes" element={<Agents />} />
                  <Route path="/contratar" element={<Hire />} />
                  <Route path="/chat" element={<Chat />} />
                  <Route path="/chat/:agentId" element={<Chat />} />
                  <Route path="/config" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </main>
            </div>
          </CheckOnboarding>
        </PrivateRoute>
      } />
    </Routes>
  );
}
