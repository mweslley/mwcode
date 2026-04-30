import { NavLink, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Agent { id: string; name: string; role: string; status: string; }

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo') || r.includes('diretor')) return '👔';
  if (r.includes('dev') || r.includes('código') || r.includes('eng') || r.includes('cto')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  if (r.includes('finance') || r.includes('financ')) return '💰';
  return '🤖';
}

export function Sidebar() {
  const navigate = useNavigate();
  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const initials = user?.name
    ? user.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  const [agents, setAgents] = useState<Agent[]>([]);
  const [inboxCount, setInboxCount] = useState(0);
  const [usage, setUsage] = useState<{ todayCost: number; monthCost: number; monthLimit?: number } | null>(null);

  useEffect(() => {
    async function fetchSidebarData() {
      try {
        const [agList, inboxRes, usageRes] = await Promise.all([
          api.get<Agent[]>('/enterprise/agents').catch(() => []),
          api.get<{ count: number }>('/issues/count/inbox').catch(() => ({ count: 0 })),
          api.get<any>('/usage').catch(() => null),
        ]);
        const seen = new Set<string>();
        const deduped = ((agList || []) as Agent[]).filter(a => {
          if (a.status !== 'active') return false;
          const key = `${a.name.trim().toLowerCase()}::${a.role.trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setAgents(deduped);
        setInboxCount((inboxRes as any)?.count ?? 0);
        if (usageRes) {
          const limRes = await api.get<any>('/usage/limits').catch(() => ({}));
          setUsage({
            todayCost: usageRes.today?.costUsd || 0,
            monthCost: usageRes.thisMonth?.costUsd || 0,
            monthLimit: limRes?.global?.monthlyUsd,
          });
        }
      } catch { /* silencioso */ }
    }
    fetchSidebarData();
    const id = setInterval(fetchSidebarData, 30_000);
    return () => clearInterval(id);
  }, []);

  function sair() {
    localStorage.clear();
    navigate('/login');
  }

  const linkStyle = ({ isActive }: { isActive: boolean }) =>
    `sidebar-link${isActive ? ' active' : ''}`;

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

        <button className="btn-new-chat" onClick={() => navigate('/issues')}>
          <span className="icon">+</span>
          Nova Tarefa
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <span className="sidebar-section">Principal</span>

        <NavLink to="/dashboard" className={linkStyle}>
          <span className="link-icon">📊</span>
          Painel
        </NavLink>

        <NavLink to="/inbox" className={linkStyle}>
          <span className="link-icon">📥</span>
          <span style={{ flex: 1 }}>Caixa de Entrada</span>
          {inboxCount > 0 && (
            <span style={{
              background: 'var(--primary)', color: '#fff',
              borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700,
            }}>
              {inboxCount}
            </span>
          )}
        </NavLink>

        <NavLink to="/chat" className={linkStyle}>
          <span className="link-icon">💬</span>
          Conversas
        </NavLink>

        <span className="sidebar-section" style={{ marginTop: 4 }}>Trabalho</span>

        <NavLink to="/issues" className={linkStyle}>
          <span className="link-icon">📋</span>
          Tarefas
        </NavLink>

        <NavLink to="/feed" className={linkStyle}>
          <span className="link-icon">📡</span>
          Atividade ao Vivo
        </NavLink>

        <NavLink to="/workflows" className={linkStyle}>
          <span className="link-icon">🔄</span>
          Rotinas
        </NavLink>

        {/* Agentes dinâmicos */}
        <span className="sidebar-section" style={{ marginTop: 4 }}>Agentes</span>

        {agents.length === 0 ? (
          <NavLink to="/agents" className={linkStyle}>
            <span className="link-icon">🤖</span>
            Nenhum agente
          </NavLink>
        ) : (
          agents.map(agent => (
            <NavLink
              key={agent.id}
              to={`/chat/${agent.id}`}
              className={linkStyle}
              style={{ alignItems: 'flex-start' }}
            >
              <span className="link-icon" style={{ marginTop: 2 }}>{agentEmoji(agent.role)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {agent.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                  {agent.role}
                </div>
              </div>
              <span style={{
                width: 7, height: 7, borderRadius: '50%',
                background: '#10b981', flexShrink: 0, marginTop: 4,
              }} title="Ativo" />
            </NavLink>
          ))
        )}

        <button
          className="ghost"
          onClick={() => navigate('/agents')}
          style={{ fontSize: 11, padding: '5px 10px', margin: '4px 8px', textAlign: 'left', width: 'calc(100% - 16px)' }}
        >
          + Contratar agente
        </button>

        <span className="sidebar-section" style={{ marginTop: 4 }}>Empresa</span>

        <NavLink to="/skills" className={linkStyle}>
          <span className="link-icon">🎯</span>
          Habilidades
        </NavLink>

        <NavLink to="/usage" className={linkStyle}>
          <span className="link-icon">📈</span>
          <span style={{ flex: 1 }}>Uso de Tokens</span>
          {usage && usage.todayCost > 0 && (
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>
              ${usage.todayCost < 0.001 ? '<0.001' : usage.todayCost.toFixed(3)}
            </span>
          )}
        </NavLink>

        <NavLink to="/settings" className={linkStyle}>
          <span className="link-icon">⚙️</span>
          Configurações
        </NavLink>
      </nav>

      {/* Token usage gauge */}
      {usage && (usage.monthCost > 0 || usage.monthLimit) && (
        <div
          onClick={() => navigate('/usage')}
          style={{
            margin: '0 10px 8px',
            padding: '8px 10px',
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)', marginBottom: 4 }}>
            <span>Gasto hoje</span>
            <span style={{ fontWeight: 600 }}>
              ${usage.todayCost < 0.001 ? '0.000' : usage.todayCost.toFixed(3)}
              {usage.monthLimit ? ` / $${usage.monthLimit.toFixed(2)} mês` : ''}
            </span>
          </div>
          {usage.monthLimit ? (
            <div style={{ height: 4, borderRadius: 3, background: 'var(--bg-3)', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.min(100, (usage.monthCost / usage.monthLimit) * 100)}%`,
                background: usage.monthCost / usage.monthLimit > 0.8 ? '#f97316' : 'var(--primary)',
                borderRadius: 3,
                transition: 'width 0.4s',
              }} />
            </div>
          ) : (
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              Este mês: ${usage.monthCost.toFixed(3)} — clique para configurar limite
            </div>
          )}
        </div>
      )}

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
