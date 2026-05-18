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

interface Run {
  id: string;
  squadId: string;
  squadName: string;
  userRequest?: string;
  status: string;
  currentStepId?: number;
  steps: any[];
  checkpoint?: { stepId: number; description: string };
  theme?: string;
  createdAt: string;
  updatedAt: string;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  requiresApproval: boolean;
  approvalStatus?: string;
  runId?: string;
}

interface UpdateInfo {
  temAtualizacao: boolean;
  atual: { sha: string; message: string };
  ultima?: { sha: string; message: string };
}

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo') || r.includes('diretor')) return '👔';
  if (r.includes('pesquisa') || r.includes('research')) return '🔍';
  if (r.includes('roteiro')) return '✍️';
  if (r.includes('dev') || r.includes('código') || r.includes('eng')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  return '🤖';
}

const RUN_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  queued:     { label: 'Na fila',         color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
  running:    { label: '⚙ Executando',    color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  checkpoint: { label: '⏸ Aguarda você', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  completed:  { label: '✅ Concluída',    color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
  failed:     { label: '❌ Falhou',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

export function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [pendingIssues, setPendingIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [doingUpdate, setDoingUpdate] = useState(false);

  const user = (() => { try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; } })();
  const company = (() => { try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; } })();

  const refresh = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [s, a, act, r, iss] = await Promise.all([
        api.get<Stats>('/dashboard/estatisticas').catch(() => null),
        api.get<Agent[]>('/enterprise/agents').catch(() => []),
        api.get<Activity[]>('/dashboard/atividade').catch(() => []),
        api.get<Run[]>('/runs').catch(() => []),
        api.get<Issue[]>('/issues').catch(() => []),
      ]);
      if (s) setStats(s);
      setAgents(((a as Agent[]) || []).filter(ag => ag.status === 'active').slice(0, 6));
      setActivity((act as Activity[]) || []);

      const allRuns = (r as Run[]) || [];
      // Mostrar runs recentes: em execução, checkpoint ou últimas concluídas
      const activeRuns = allRuns.filter(run => ['running', 'checkpoint', 'queued'].includes(run.status));
      const recentCompleted = allRuns.filter(run => run.status === 'completed').slice(0, 3);
      setRuns([...activeRuns, ...recentCompleted].slice(0, 8));

      const allIssues = (iss as Issue[]) || [];
      setPendingIssues(allIssues.filter(i =>
        (i.requiresApproval && i.approvalStatus === 'pendente') ||
        (i.id.startsWith('run:') && i.status === 'em_revisao')
      ));

      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  async function checkForUpdate() {
    try {
      const info = await api.get<UpdateInfo>('/system/update-check');
      setUpdateInfo(info ?? null);
    } catch {}
  }

  async function runSystemUpdate() {
    if (!confirm('Atualizar o MWCode para a versão mais recente?\n\nO servidor vai reiniciar. A página recarregará automaticamente quando estiver pronto.')) return;
    setDoingUpdate(true);
    try {
      await api.post('/system/update', {});
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch('/api/health');
          if (r.ok) { clearInterval(poll); window.location.reload(); }
        } catch {}
        if (attempts > 60) { clearInterval(poll); window.location.reload(); }
      }, 3000);
    } catch (e: any) {
      alert('Erro ao iniciar atualização: ' + (e?.message || 'desconhecido'));
      setDoingUpdate(false);
    }
  }

  useEffect(() => {
    refresh(true);
    checkForUpdate();
    const interval = setInterval(() => refresh(), 20000);
    const updateInterval = setInterval(checkForUpdate, 60 * 60 * 1000);
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

  const checkpointRuns = runs.filter(r => r.status === 'checkpoint');
  const runningRuns    = runs.filter(r => r.status === 'running');
  const pendingApprovals = pendingIssues.filter(i => !i.id.startsWith('run:'));
  const totalPending   = checkpointRuns.length + pendingApprovals.length;

  return (
    <div className="page">
      {/* Header */}
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
              {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {updateInfo?.temAtualizacao && (
              <button onClick={runSystemUpdate} disabled={doingUpdate}
                title={updateInfo.ultima?.message || 'Atualização disponível'}
                style={{ fontSize: 12, padding: '5px 12px', background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.45)', color: '#fbbf24' }}>
                {doingUpdate ? '⏳ Atualizando…' : '⬆️ Nova versão'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Banner: pendências de ação */}
      {totalPending > 0 && (
        <div style={{ padding: '14px 18px', marginBottom: 20, borderRadius: 12, background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(146,48,249,0.08))', border: '1px solid rgba(245,158,11,0.35)', display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 28, flexShrink: 0 }}>🔔</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#f59e0b', marginBottom: 4 }}>
              {totalPending} {totalPending === 1 ? 'item requer' : 'itens requerem'} sua atenção
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              {checkpointRuns.length > 0 && (
                <span>⏸ <strong>{checkpointRuns.length}</strong> pipeline{checkpointRuns.length > 1 ? 's' : ''} no checkpoint</span>
              )}
              {pendingApprovals.length > 0 && (
                <span>⏳ <strong>{pendingApprovals.length}</strong> aprovação{pendingApprovals.length > 1 ? 'ões' : ''} pendente{pendingApprovals.length > 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {checkpointRuns.length > 0 && (
              <button style={{ fontSize: 12, padding: '7px 14px', background: 'rgba(245,158,11,0.15)', borderColor: 'rgba(245,158,11,0.4)', color: '#f59e0b', fontWeight: 700 }}
                onClick={() => navigate('/squads')}>
                Ir às equipes →
              </button>
            )}
            {pendingApprovals.length > 0 && (
              <button style={{ fontSize: 12, padding: '7px 14px' }} onClick={() => navigate('/issues')}>
                Ver aprovações →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className={`stat-card${!loading ? ' purple-accent' : ''}`} style={{ cursor: 'pointer' }} onClick={() => navigate('/agents')}>
          <div className="stat-label">Agentes Ativos</div>
          <div className="stat-value">{loading ? '—' : (stats?.agentesAtivos ?? agents.length)}</div>
          <div className="stat-sub">prontos para trabalhar</div>
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/issues')}>
          <div className="stat-label">Mensagens</div>
          <div className="stat-value">{loading ? '—' : (stats?.mensagensTrocadas ?? 0)}</div>
          <div className="stat-sub">total de interações</div>
        </div>
        <div className={`stat-card${runningRuns.length > 0 ? ' green-accent' : ''}`} style={{ cursor: 'pointer', position: 'relative' }}
          onClick={() => navigate('/squads')}>
          <div className="stat-label">Pipelines Ativos</div>
          <div className="stat-value">{loading ? '—' : runningRuns.length + checkpointRuns.length}</div>
          <div className="stat-sub">
            {checkpointRuns.length > 0 ? `${checkpointRuns.length} aguardando você` : 'rodando agora'}
          </div>
          {checkpointRuns.length > 0 && (
            <div style={{ position: 'absolute', top: 10, right: 10, width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b88' }} />
          )}
        </div>
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/workflows')}>
          <div className="stat-label">Workflows</div>
          <div className="stat-value">{loading ? '—' : (stats?.workflowsAtivos ?? 0)}</div>
          <div className="stat-sub">{stats?.workflowRuns ?? 0} execuções</div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 28 }}>
        {[
          { icon: '💬', label: 'Chat', desc: 'Conversar com agente', to: '/chat' },
          { icon: '👥', label: 'Equipes', desc: 'Squads e pipelines', to: '/squads' },
          { icon: '📋', label: 'Tarefas', desc: 'Issues e aprovações', to: '/issues' },
          { icon: '⚡', label: 'Workflows', desc: 'Automações', to: '/workflows' },
        ].map(a => (
          <button key={a.to} onClick={() => navigate(a.to)} className="ghost"
            style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '14px 16px', gap: 5, height: 'auto', textAlign: 'left' }}>
            <span style={{ fontSize: 22 }}>{a.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', display: 'block' }}>{a.label}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>{a.desc}</span>
          </button>
        ))}
      </div>

      {/* Pipelines — linha dupla */}
      <div style={{ display: 'grid', gridTemplateColumns: runs.length > 0 ? '1fr 1fr' : '1fr', gap: 20, marginBottom: 24 }}>

        {/* Pipelines ativos */}
        {runs.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 14, fontWeight: 700 }}>▶ Pipelines</h2>
              <button className="ghost" onClick={() => navigate('/squads')} style={{ fontSize: 12, padding: '4px 10px' }}>Ver todos →</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {runs.map(run => {
                const si = RUN_STATUS[run.status] || RUN_STATUS.queued;
                return (
                  <div key={run.id} className="card"
                    style={{ padding: '12px 14px', cursor: 'pointer', borderLeft: `3px solid ${si.color}` }}
                    onClick={() => navigate('/squads')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, color: si.color, background: si.bg }}>
                        {si.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600 }}>
                        {run.squadName}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: run.checkpoint ? 4 : 0 }}>
                      {run.theme || run.userRequest || 'Pipeline'}
                    </div>
                    {run.checkpoint && (
                      <div style={{ fontSize: 11, color: '#f59e0b' }}>⏸ {run.checkpoint.description}</div>
                    )}
                    <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4 }}>
                      {run.steps?.length || 0} step{(run.steps?.length || 0) !== 1 ? 's' : ''} concluído{(run.steps?.length || 0) !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Agentes ativos */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>🤖 Agentes ativos</h2>
            <button className="ghost" onClick={() => navigate('/agents')} style={{ fontSize: 12, padding: '4px 10px' }}>Ver todos →</button>
          </div>
          {loading ? (
            <div style={{ color: 'var(--muted)', fontSize: 13 }}>Carregando...</div>
          ) : agents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 24 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhum agente ainda</p>
              <button style={{ marginTop: 12, fontSize: 12 }} onClick={() => navigate('/agents')}>+ Contratar</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {agents.map(agent => (
                <div key={agent.id} className="card" style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => navigate(`/chat/${agent.id}`)}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, flexShrink: 0 }}>
                    {agentEmoji(agent.role)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{agent.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{agent.role}</div>
                  </div>
                  <span style={{ fontSize: 14, color: 'var(--muted)' }}>›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Atividade recente */}
      {activity.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700 }}>💬 Atividade recente</h2>
            <button className="ghost" onClick={() => navigate('/chat')} style={{ fontSize: 12, padding: '4px 10px' }}>Ver chat →</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
            {activity.slice(0, 4).map((act, i) => (
              <div key={i} className="card" style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => navigate(`/chat/${act.agentId}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 14 }}>{agentEmoji(act.role)}</span>
                  <span style={{ fontWeight: 600, fontSize: 12 }}>{act.agentName}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>
                    {new Date(act.updatedAt).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {act.lastMessage}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discord */}
      <a href="https://discord.gg/5bVr53kRAp" target="_blank" rel="noopener noreferrer"
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', marginTop: 24, background: 'linear-gradient(90deg, rgba(88,101,242,0.12), rgba(146,48,249,0.08))', border: '1px solid rgba(88,101,242,0.25)', borderRadius: 10, textDecoration: 'none', color: 'var(--fg-2)' }}>
        <span style={{ fontSize: 20 }}>👾</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#7289da' }}>Comunidade MWCode no Discord</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Suporte, dicas e novidades.</div>
        </div>
        <span style={{ fontSize: 12, color: '#7289da', fontWeight: 600 }}>Entrar →</span>
      </a>
    </div>
  );
}
