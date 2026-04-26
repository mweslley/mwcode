import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Stats {
  agentesAtivos: number;
  tarefasConcluidas: number;
  custoTotal: number;
  performanceMedia: number;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  adapter: string;
  model: string;
  status: string;
  performance: number;
  tasksCompleted: number;
}

function agentEmoji(role: string) {
  const r = role?.toLowerCase() || '';
  if (r.includes('ceo') || r.includes('diretor')) return '👔';
  if (r.includes('dev') || r.includes('código') || r.includes('eng')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  return '🤖';
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const company = (() => {
    try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; }
  })();

  useEffect(() => {
    Promise.all([
      api.get<Stats>('/dashboard/estatisticas').catch(() => null),
      api.get<Agent[]>('/enterprise/agents').catch(() => []),
    ]).then(([s, a]) => {
      if (s) setStats(s);
      setAgents(((a as Agent[]) || []).filter(ag => ag.status === 'active').slice(0, 6));
    }).finally(() => setLoading(false));
  }, []);

  const hora = new Date().getHours();
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] || 'usuário';

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{greeting}, {firstName} 👋</h1>
        <p className="page-subtitle">
          {company?.name ? `${company.name} · ` : ''}Seu workspace MWCode
        </p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <div className={`stat-card${loading ? '' : ' purple-accent'}`}>
          <div className="stat-label">Agentes Ativos</div>
          <div className="stat-value">{loading ? '—' : (stats?.agentesAtivos ?? agents.length)}</div>
          <div className="stat-sub">prontos para trabalhar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Tarefas Concluídas</div>
          <div className="stat-value">{loading ? '—' : (stats?.tarefasConcluidas ?? 0)}</div>
          <div className="stat-sub">no total</div>
        </div>
        <div className={`stat-card${loading ? '' : ' green-accent'}`}>
          <div className="stat-label">Performance Média</div>
          <div className="stat-value">
            {loading ? '—' : stats?.performanceMedia ?? 0}
            {!loading && <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>%</span>}
          </div>
          <div className="stat-sub">dos agentes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Custo Estimado</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {loading ? '—' : `R$ ${(stats?.custoTotal ?? 0).toFixed(2)}`}
          </div>
          <div className="stat-sub">no período</div>
        </div>
      </div>

      {/* Ações rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 32 }}>
        {[
          { icon: '💬', label: 'Novo Chat', desc: 'Conversar com agente', to: '/chat' },
          { icon: '🤖', label: 'Contratar Agente', desc: 'Adicionar à equipe', to: '/agents' },
          { icon: '⚡', label: 'Criar Workflow', desc: 'Automatizar tarefas', to: '/workflows' },
          { icon: '🔌', label: 'Integrações', desc: 'Conectar ferramentas', to: '/integrations' },
        ].map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            style={{
              flexDirection: 'column',
              alignItems: 'flex-start',
              padding: '16px 18px',
              gap: 6,
              height: 'auto',
              textAlign: 'left',
              background: 'var(--bg-2)',
              borderColor: 'var(--border)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              cursor: 'pointer',
              color: 'inherit',
              transition: 'all 0.15s',
            }}
            className="ghost"
          >
            <span style={{ fontSize: 24 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', display: 'block' }}>{a.label}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{a.desc}</span>
          </button>
        ))}
      </div>

      {/* Agentes */}
      {!loading && agents.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Agentes ativos</h2>
            <button className="ghost" onClick={() => navigate('/agents')} style={{ fontSize: 12, padding: '5px 12px' }}>
              Ver todos →
            </button>
          </div>

          <div className="agents-grid">
            {agents.map(agent => (
              <div key={agent.id} className="agent-card">
                <div className="agent-header">
                  <div className="agent-avatar">{agentEmoji(agent.role)}</div>
                  <div>
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-role">{agent.role}</div>
                  </div>
                </div>
                <div className="agent-meta">
                  <span className="badge badge-purple">{agent.adapter}</span>
                  <span className="badge badge-gray">{agent.model?.split('/').pop()?.split(':')[0] ?? agent.model}</span>
                </div>
                <div className="agent-actions">
                  <button
                    onClick={() => navigate(`/chat/${agent.id}`)}
                    style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px' }}
                  >
                    💬 Conversar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && agents.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">🤖</div>
          <h3>Nenhum agente ainda</h3>
          <p>Contrate seu primeiro agente para começar a automatizar tarefas com IA.</p>
          <button onClick={() => navigate('/agents')} style={{ marginTop: 16 }}>
            + Contratar agente
          </button>
        </div>
      )}
    </div>
  );
}
