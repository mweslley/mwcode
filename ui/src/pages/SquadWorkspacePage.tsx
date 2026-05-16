import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface Squad {
  id: string;
  name: string;
  description: string;
  mission: string;
  agentIds: string[];
  leaderId?: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  createdByAgentName?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

const STATUS_INFO = {
  active:    { label: 'Ativa',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  paused:    { label: 'Pausada',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Concluída', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const ISSUE_STATUS: Record<string, { label: string; color: string }> = {
  todo:        { label: 'A fazer',       color: '#6b7280' },
  backlog:     { label: 'Backlog',       color: '#6b7280' },
  em_progresso:{ label: 'Em andamento',  color: '#3b82f6' },
  em_revisao:  { label: 'Em revisão',    color: '#f59e0b' },
  concluido:   { label: 'Concluído',     color: '#10b981' },
  cancelado:   { label: 'Cancelado',     color: '#ef4444' },
};

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo')) return '👔';
  if (r.includes('pesquisa') || r.includes('research')) return '🔍';
  if (r.includes('roteiro') || r.includes('roteirista')) return '✍️';
  if (r.includes('veredito') || r.includes('retenção')) return '⚖️';
  if (r.includes('qualidade') || r.includes('qc') || r.includes('qa')) return '🔬';
  if (r.includes('direção') || r.includes('diretor') || r.includes('visual')) return '🎬';
  if (r.includes('edição') || r.includes('editor')) return '🎞️';
  if (r.includes('dev') || r.includes('código') || r.includes('eng')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  if (r.includes('financ')) return '💵';
  return '🤖';
}

export function SquadWorkspacePage() {
  const { squadId } = useParams<{ squadId: string }>();
  const navigate = useNavigate();

  const [squad, setSquad] = useState<Squad | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [squads, agList, issues] = await Promise.all([
        api.get<Squad[]>('/squads'),
        api.get<Agent[]>('/enterprise/agents').catch(() => []),
        api.get<Issue[]>('/issues').catch(() => []),
      ]);
      const sq = (squads || []).find(s => s.id === squadId);
      if (!sq) { navigate('/squads'); return; }
      setSquad(sq);

      const agentMap = Object.fromEntries((agList || []).map((a: Agent) => [a.id, a]));
      setAgents(sq.agentIds.map(id => agentMap[id]).filter(Boolean));

      // Filtra tarefas atribuídas a membros desta equipe
      const memberIds = new Set(sq.agentIds);
      const squadIssues = (issues || []).filter((i: Issue) =>
        i.assigneeAgentId && memberIds.has(i.assigneeAgentId)
      );
      setAllIssues(squadIssues);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [squadId]);

  async function toggleStatus() {
    if (!squad) return;
    setTogglingStatus(true);
    const next = squad.status === 'active' ? 'paused' : 'active';
    await api.put(`/squads/${squad.id}`, { status: next }).catch(() => {});
    setSquad(s => s ? { ...s, status: next } : s);
    setTogglingStatus(false);
  }

  if (loading) {
    return <div className="page"><div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Carregando...</div></div>;
  }

  if (!squad) return null;

  const info = STATUS_INFO[squad.status];
  const leader = squad.leaderId ? agents.find(a => a.id === squad.leaderId) : null;
  const otherMembers = agents.filter(a => a.id !== squad.leaderId);

  const filtered = statusFilter === 'all'
    ? allIssues
    : allIssues.filter(i => i.status === statusFilter);

  const done   = allIssues.filter(i => i.status === 'concluido').length;
  const active = allIssues.filter(i => i.status === 'em_progresso').length;
  const todo   = allIssues.filter(i => ['todo', 'backlog'].includes(i.status)).length;

  return (
    <div className="page">
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Link to="/squads" style={{ color: 'var(--primary)', textDecoration: 'none' }}>👥 Equipes</Link>
        <span>/</span>
        <span>{squad.name}</span>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 20, borderLeft: `4px solid ${info.color}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{squad.name}</h1>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: info.bg, color: info.color, textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {info.label}
              </span>
            </div>
            {squad.description && (
              <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--fg-2)' }}>{squad.description}</p>
            )}
            {squad.mission && (
              <div style={{
                fontSize: 12, padding: '8px 12px', borderRadius: 8,
                background: 'var(--bg-2)', borderLeft: '3px solid var(--primary)',
                color: 'var(--fg-2)', lineHeight: 1.6,
              }}>
                <strong style={{ color: 'var(--primary)' }}>Missão:</strong> {squad.mission}
              </div>
            )}
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {leader && (
              <button
                onClick={() => navigate(`/chat/${leader.id}`)}
                style={{ fontSize: 12, padding: '8px 16px', fontWeight: 700 }}
                title={`Abrir chat com ${leader.name} (líder)`}
              >
                💬 Iniciar nova run
              </button>
            )}
            <button
              className="ghost"
              onClick={toggleStatus}
              disabled={togglingStatus}
              style={{ fontSize: 12, padding: '8px 14px' }}
            >
              {squad.status === 'active' ? '⏸ Pausar equipe' : '▶ Ativar equipe'}
            </button>
            <button
              className="ghost"
              onClick={() => navigate('/squads')}
              style={{ fontSize: 12, padding: '8px 12px' }}
            >
              ✏️ Editar
            </button>
          </div>
        </div>

        {/* Membros */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Equipe:</span>

          {/* Líder em destaque */}
          {leader && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.35)',
              fontSize: 12,
            }}>
              <span>👑</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>{leader.name}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>— líder</span>
              <button
                className="ghost"
                style={{ padding: '1px 6px', fontSize: 10, marginLeft: 2 }}
                onClick={() => navigate(`/chat/${leader.id}`)}
                title="Conversar com o líder"
              >
                💬
              </button>
            </div>
          )}

          {/* Outros membros */}
          {otherMembers.map(a => (
            <div key={a.id} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 20,
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              fontSize: 12, cursor: 'pointer',
            }}
              onClick={() => navigate(`/chat/${a.id}`)}
              title={`Conversar com ${a.name}`}
            >
              <span>{agentEmoji(a.role)}</span>
              <span style={{ fontWeight: 600 }}>{a.name}</span>
            </div>
          ))}

          {agents.length === 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum membro atribuído</span>
          )}
        </div>
      </div>

      {/* Como iniciar uma run */}
      {squad.status === 'paused' && (
        <div style={{
          padding: '12px 16px', marginBottom: 20,
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: 10, fontSize: 13, color: '#f59e0b',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>⏸</span>
          <span>Equipe pausada — o CEO não atribui tarefas aos membros. <button className="ghost" style={{ fontSize: 12, color: '#f59e0b', padding: '2px 8px' }} onClick={toggleStatus}>Ativar agora →</button></span>
        </div>
      )}

      {leader && squad.status === 'active' && (
        <div style={{
          padding: '14px 18px', marginBottom: 20,
          background: 'rgba(146,48,249,0.07)', border: '1px solid rgba(146,48,249,0.2)',
          borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)', marginBottom: 3 }}>
              💡 Como iniciar um trabalho com esta equipe
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.6 }}>
              Clique em <strong>"Iniciar nova run"</strong> para abrir o chat com {leader.name} (líder).
              Descreva o que precisa — o líder coordena os outros membros e distribui as tarefas automaticamente.
            </div>
          </div>
          <button
            onClick={() => navigate(`/chat/${leader.id}`)}
            style={{ fontSize: 13, padding: '9px 20px', fontWeight: 700, flexShrink: 0 }}
          >
            💬 Iniciar nova run
          </button>
        </div>
      )}

      {/* Estatísticas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Em andamento', value: active, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { label: 'A fazer',      value: todo,   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Concluídas',   value: done,   color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{
            padding: '14px 18px', textAlign: 'center',
            background: stat.bg, border: `1px solid ${stat.color}33`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Tarefas da equipe */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>📋 Tarefas da equipe</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'em_progresso', 'todo', 'concluido'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                fontSize: 11, padding: '4px 12px',
                background: statusFilter === s ? 'var(--primary)' : 'var(--bg-2)',
                color: statusFilter === s ? '#fff' : 'var(--fg-2)',
                borderColor: statusFilter === s ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {s === 'all' ? 'Todas' : ISSUE_STATUS[s]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            {allIssues.length === 0 ? 'Nenhuma tarefa ainda' : 'Nenhuma tarefa com esse filtro'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380, margin: '0 auto' }}>
            {allIssues.length === 0
              ? `Inicie uma nova run conversando com ${leader?.name ?? 'o líder'}. As tarefas criadas aparecerão aqui.`
              : 'Tente outro filtro de status.'}
          </p>
          {leader && allIssues.length === 0 && (
            <button style={{ marginTop: 16 }} onClick={() => navigate(`/chat/${leader.id}`)}>
              💬 Iniciar primeira run
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(issue => {
            const st = ISSUE_STATUS[issue.status] ?? { label: issue.status, color: '#6b7280' };
            const member = agents.find(a => a.id === issue.assigneeAgentId);
            return (
              <div key={issue.id} className="card" style={{
                padding: '12px 16px',
                borderLeft: `3px solid ${st.color}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{issue.title}</span>
                      <span style={{
                        fontSize: 10, padding: '1px 7px', borderRadius: 10,
                        background: `${st.color}18`, color: st.color, fontWeight: 700,
                      }}>
                        {st.label}
                      </span>
                    </div>
                    {issue.description && (
                      <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                        {issue.description.slice(0, 120)}{issue.description.length > 120 ? '…' : ''}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      {member && (
                        <span
                          style={{ cursor: 'pointer', color: 'var(--primary)' }}
                          onClick={() => navigate(`/chat/${member.id}`)}
                          title="Abrir chat com este agente"
                        >
                          {agentEmoji(member.role)} {member.name}
                        </span>
                      )}
                      <span>🕐 {new Date(issue.createdAt).toLocaleDateString('pt-BR')}</span>
                      {issue.completedAt && (
                        <span style={{ color: '#10b981' }}>✅ {new Date(issue.completedAt).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>
                  </div>
                  {member && (
                    <button
                      className="ghost"
                      style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }}
                      onClick={() => navigate(`/chat/${member.id}`)}
                      title={`Falar com ${member.name}`}
                    >
                      💬
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nota sobre outputs */}
      {done > 0 && (
        <div style={{
          marginTop: 20, padding: '12px 16px',
          background: 'var(--bg-2)', border: '1px solid var(--border)',
          borderRadius: 10, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6,
        }}>
          💡 <strong style={{ color: 'var(--fg-2)' }}>Arquivos e entregas:</strong> Para ver arquivos gerados (vídeos, documentos, código), acesse o chat de cada membro ou peça ao líder um resumo do que foi produzido.
        </div>
      )}
    </div>
  );
}
