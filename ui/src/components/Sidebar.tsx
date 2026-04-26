import { NavLink, useNavigate } from 'react-router-dom';

export function Sidebar() {
  const navigate = useNavigate();
  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  function sair() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-top">
        <NavLink to="/" className="sidebar-brand" style={{ textDecoration: 'none' }}>
          <div className="sidebar-brand-icon">⚡</div>
          <div>
            <div className="sidebar-brand-name">MWCode</div>
            <span className="sidebar-brand-sub">AI Workspace</span>
          </div>
        </NavLink>

        <button className="btn-new-chat" onClick={() => navigate('/chat')}>
          <span className="icon">+</span>
          Novo Chat
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <span className="sidebar-section">Principal</span>

        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">📊</span>
          Dashboard
        </NavLink>

        <NavLink to="/chat" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">💬</span>
          Conversas
        </NavLink>

        <NavLink to="/agents" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">🤖</span>
          Agentes
        </NavLink>

        <span className="sidebar-section" style={{ marginTop: 4 }}>Automação</span>

        <NavLink to="/workflows" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">⚡</span>
          Workflows
        </NavLink>

        <NavLink to="/integrations" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">🔌</span>
          Integrações
        </NavLink>

        <span className="sidebar-section" style={{ marginTop: 4 }}>Config</span>

        <NavLink to="/skills" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">🎯</span>
          Skills
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
          <span className="link-icon">⚙️</span>
          Configurações
        </NavLink>
      </nav>

      {/* User */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name truncate">{user?.name || 'Usuário'}</div>
            <div className="sidebar-user-email">{user?.email}</div>
          </div>
        </div>
        <button className="sidebar-logout" onClick={sair}>
          <span>↩</span> Sair
        </button>
      </div>
    </aside>
  );
}
