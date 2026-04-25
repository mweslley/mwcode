import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
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
import { Skills } from './pages/Skills';

/** Bloqueia rota se não tiver token (redireciona pra /login). */
function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

/**
 * Bloqueia rota se ainda não escolheu o modo (redireciona pra /mode).
 * O modo é setado pela ModeSelect e fica em localStorage('mode').
 */
function RequireMode({ children }: { children: React.ReactNode }) {
  const mode = localStorage.getItem('mode');
  return mode ? <>{children}</> : <Navigate to="/mode" replace />;
}

/**
 * Específico do modo empresa: força onboarding antes do dashboard
 * caso ainda não tenha cadastrado a empresa.
 */
function RequireCompany({ children }: { children: React.ReactNode }) {
  const company = localStorage.getItem('company');
  return company ? <>{children}</> : <Navigate to="/onboarding" replace />;
}

/** Layout principal com sidebar — items mudam conforme o modo. */
function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const mode = localStorage.getItem('mode');
  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;

  function trocarModo() {
    if (confirm('Trocar de modo? Você voltará pra tela de escolha.')) {
      localStorage.removeItem('mode');
      navigate('/mode');
    }
  }

  function sair() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1 className="logo">MWCode</h1>

        {mode === 'personal' && (
          <nav>
            <span className="section">Modo Pessoal</span>
            <NavLink to="/single">💬 Chat</NavLink>
            <NavLink to="/skills">🎯 Skills</NavLink>
            <NavLink to="/config">⚙️ Configurações</NavLink>
            <hr />
            <a onClick={trocarModo} style={{ cursor: 'pointer' }}>🔄 Trocar modo</a>
            <a onClick={sair} style={{ cursor: 'pointer' }}>🚪 Sair</a>
          </nav>
        )}

        {mode === 'enterprise' && (
          <nav>
            <span className="section">Empresa</span>
            <NavLink to="/dashboard">📊 Painel</NavLink>
            <NavLink to="/agentes">👥 Agentes</NavLink>
            <NavLink to="/contratar">➕ Contratar</NavLink>
            <NavLink to="/chat">💬 Chat</NavLink>
            <NavLink to="/skills">🎯 Skills</NavLink>
            <NavLink to="/config">⚙️ Configurações</NavLink>
            <hr />
            <a onClick={trocarModo} style={{ cursor: 'pointer' }}>🔄 Trocar modo</a>
            <a onClick={sair} style={{ cursor: 'pointer' }}>🚪 Sair</a>
          </nav>
        )}

        {user && (
          <div className="sidebar-user">
            <small>{user.email}</small>
          </div>
        )}
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Escolha de modo (precisa estar logado, mas é antes do layout) */}
      <Route
        path="/mode"
        element={
          <PrivateRoute>
            <ModeSelect />
          </PrivateRoute>
        }
      />

      {/* Onboarding (modo empresa, antes do layout) */}
      <Route
        path="/onboarding"
        element={
          <PrivateRoute>
            <Onboarding />
          </PrivateRoute>
        }
      />

      {/* App principal — exige token + modo */}
      <Route
        path="/*"
        element={
          <PrivateRoute>
            <RequireMode>
              <AppLayout>
                <Routes>
                  {/* Modo pessoal */}
                  <Route path="/single" element={<ChatSingle />} />

                  {/* Modo empresa — exige company cadastrada */}
                  <Route
                    path="/dashboard"
                    element={
                      <RequireCompany>
                        <Dashboard />
                      </RequireCompany>
                    }
                  />
                  <Route
                    path="/agentes"
                    element={
                      <RequireCompany>
                        <Agents />
                      </RequireCompany>
                    }
                  />
                  <Route
                    path="/contratar"
                    element={
                      <RequireCompany>
                        <Hire />
                      </RequireCompany>
                    }
                  />
                  <Route
                    path="/chat"
                    element={
                      <RequireCompany>
                        <Chat />
                      </RequireCompany>
                    }
                  />
                  <Route
                    path="/chat/:agentId"
                    element={
                      <RequireCompany>
                        <Chat />
                      </RequireCompany>
                    }
                  />

                  {/* Comum a ambos os modos */}
                  <Route path="/skills" element={<Skills />} />
                  <Route path="/config" element={<Settings />} />

                  {/* Fallback: vai pra tela inicial do modo */}
                  <Route
                    path="*"
                    element={
                      <Navigate
                        to={
                          localStorage.getItem('mode') === 'personal'
                            ? '/single'
                            : '/dashboard'
                        }
                        replace
                      />
                    }
                  />
                </Routes>
              </AppLayout>
            </RequireMode>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
