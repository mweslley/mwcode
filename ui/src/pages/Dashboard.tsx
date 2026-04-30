import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Stats {
  agentesAtivos: number;
  agentesDemitidos?: number;
  tarefasConcluidas: number;
  custoTotal: number;
  performanceMedia: number;
  workflowsAtivos?: number;
  workflowRuns?: number;
  mensagensTrocadas?: number;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  provider?: string;
  adapter?: string;
  model: string;
  status: string;
  performance?: number;
  tasksCompleted?: number;
}

interface Activity {
  agentId: string;
  agentName: string;
  lastMessage: string;
  role: string;
  updatedAt: string;
}

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo') || r.includes('diretor')) return '👔';
  if (r.includes('dev') || r.includes('código') || r.includes('eng')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  return '🤖';
}

interface UpdateInfo {
  temAtualizacao: boolean;
  atual: { sha: string; message: string };
  ultima?: { sha: string; message: string };
}

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [doingUpdate, setDoingUpdate] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const company = (() => { try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; } })();

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [s, a, act] = await Promise.all([
        api.get<Stats>('/dashboard/estatisticas').catch(() => null),
        api.get<Agent[]>('/enterprise/agents').catch(() => []),
        api.get<Activity[]>('/dashboard/atividade').catch(() => []),
      ]);
      if (s) setStats(s);
      setAgents(((a as Agent[]) || []).filter(ag => ag.status === 'active').slice(0, 6));
      setActivity((act as Activity[]) || []);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  async function checkForUpdate() {
    try {
      const info = await api.get<UpdateInfo>('/system/update-check');
      setUpdateInfo(info ?? null);
    } catch {
      // silencia erros — não queremos quebrar o dashboard por isso
    }
  }

  async function runSystemUpdate() {
    if (!confirm('Atualizar o MWCode para a versão mais recente?\n\nO servidor vai reiniciar e a página recarregará em ~30s.')) return;
    setDoingUpdate(true);
    try {
      await api.post('/system/update', {});
      setTimeout(() => window.location.reload(), 30_000);
    } catch (e: any) {
      alert('Erro ao iniciar atualização: ' + (e?.message || 'desconhecido'));
      setDoingUpdate(false);
    }
  }

  useEffect(() => {
    refresh(true);
    checkForUpdate(); // checa atualização ao abrir
    const interval = setInterval(() => refresh(), 15000);
    const updateInterval = setInterval(checkForUpdate, 60 * 60 * 1000); // re-checa a cada 1h
    // Refresh imediato quando o chat enviar mensagem
    const onChatUpdate = () => refresh();
    window.addEventListener('mwcode:chat-updated', onChatUpdate);
    return () => {
      clearInterval(interval);
      clearInterval(updateInterval);
      window.removeEventListener('mwcode:chat-updated', onChatUpdate);
    };
  }, [refresh]);

  const hora = new Date().getHours();
  const greeting = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = user?.name?.split(' ')[0] || 'usuário';

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">{greeting}, {firstName} 👋</h1>
            <p className="page-subtitle">
              {company?.name ? `${company.name} · ` : ''}Seu workspace MWCode
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Atualizado {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {updateInfo?.temAtualizacao && (
              <button
                onClick={runSystemUpdate}
                disabled={doingUpdate}
                title={updateInfo.ultima?.message ? `Nova versão: ${updateInfo.ultima.message}` : 'Atualização disponível'}
                style={{
                  fontSize: 12, padding: '5px 12px',
                  background: 'rgba(245,158,11,0.15)',
                  borderColor: 'rgba(245,158,11,0.45)',
                  color: '#fbbf24',
                }}
              >
                {doingUpdate ? '⏳ Atualizando…' : '⬆️ Nova versão'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Discord invite banner */}
      <a
        href="https://discord.gg/5bVr53kRAp"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 16px', marginBottom: 20,
          background: 'linear-gradient(90deg, rgba(88,101,242,0.15), rgba(146,48,249,0.1))',
          border: '1px solid rgba(88,101,242,0.3)',
          borderRadius: 10, textDecoration: 'none', color: 'var(--fg-2)',
        }}
      >
        <span style={{ fontSize: 22 }}>👾</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#7289da' }}>Comunidade MWCode no Discord</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Suporte, dicas, novidades e integração com outros usuários.</div>
        </div>
        <span style={{ fontSize: 12, color: '#7289da', fontWeight: 600 }}>Entrar no servidor →</span>
      </a>

      {/* Stats */}
      <div className="stats-grid">
        <div className={`stat-card${!loading ? ' purple-accent' : ''}`}>
          <div className="stat-label">Agentes Ativos</div>
          <div className="stat-value">{loading ? '—' : (stats?.agentesAtivos ?? agents.length)}</div>
          <div className="stat-sub">prontos para trabalhar</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Mensagens Trocadas</div>
          <div className="stat-value">{loading ? '—' : (stats?.mensagensTrocadas ?? 0)}</div>
          <div className="stat-sub">total de interações</div>
        </div>
        <div className={`stat-card${!loading ? ' green-accent' : ''}`}>
          <div className="stat-label">Workflows Ativos</div>
          <div className="stat-value">{loading ? '—' : (stats?.workflowsAtivos ?? 0)}</div>
          <div className="stat-sub">{stats?.workflowRuns ?? 0} execuções no total</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Performance Média</div>
          <div className="stat-value">
            {loading ? '—' : stats?.performanceMedia ?? 0}
            {!loading && <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 400 }}>%</span>}
          </div>
          <div className="stat-sub">dos agentes</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 28 }}>
        {[
          { icon: '💬', label: 'Novo Chat', desc: 'Conversar com agente', to: '/chat' },
          { icon: '🤖', label: 'Contratar Agente', desc: 'Adicionar à equipe', to: '/agents' },
          { icon: '⚡', label: 'Criar Workflow', desc: 'Automatizar tarefas', to: '/workflows' },
          { icon: '🎯', label: 'Skills', desc: 'Personalidades de IA', to: '/skills' },
        ].map(a => (
          <button
            key={a.to}
            onClick={() => navigate(a.to)}
            className="ghost"
            style={{
              flexDirection: 'column', alignItems: 'flex-start',
              padding: '14px 16px', gap: 5, height: 'auto', textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', display: 'block' }}>{a.label}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{a.desc}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Agentes */}
        <div>
          <div className="flex items-center justify-between mb-4" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Agentes ativos</h2>
            <button className="ghost" onClick={() => navigate('/agents')} style={{ fontSize: 12, padding: '4px 10px' }}>
              Ver todos →
            </button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Carregando...</div>
          ) : agents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum agente ainda</p>
              <button style={{ marginTop: 12, fontSize: 12 }} onClick={() => navigate('/agents')}>
                + Contratar
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agents.map(agent => (
                <div key={agent.id} className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: 'var(--primary-dim)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>
                    {agentEmoji(agent.role)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{agent.role}</div>
                  </div>
                  <button
                    style={{ fontSize: 11, padding: '5px 10px' }}
                    onClick={() => navigate(`/chat/${agent.id}`)}
                  >
                    💬
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Atividade recente */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600 }}>Atividade recente</h2>
            <button className="ghost" onClick={() => navigate('/chat')} style={{ fontSize: 12, padding: '4px 10px' }}>
              Ver chat →
            </button>
          </div>

          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Carregando...</div>
          ) : activity.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>💬</div>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Sem atividade ainda</p>
              <button style={{ marginTop: 12, fontSize: 12 }} onClick={() => navigate('/chat')}>
                Iniciar conversa
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.slice(0, 5).map((act, i) => (
                <div
                  key={i}
                  className="card"
                  style={{ padding: '10px 14px', cursor: 'pointer' }}
                  onClick={() => navigate(`/chat/${act.agentId}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 15 }}>{agentEmoji(act.agentName)}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{act.agentName}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
                      {new Date(act.updatedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {act.lastMessage}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
