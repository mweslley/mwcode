import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';

interface IntegrationReq {
  integrationId: string;
  integrationName: string;
  fields: { key: string; label: string; type: string; placeholder: string }[];
  tools: string[];
  skills: string[];
  configured: boolean;
}

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
  logs?: { ts: string; msg: string; ok?: boolean }[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Output {
  id: string;
  issueId?: string;
  issueTitle?: string;
  agentId?: string;
  agentName?: string;
  type: 'text' | 'url' | 'markdown' | 'code';
  title: string;
  content: string;
  createdAt: string;
}

const STATUS_INFO = {
  active:    { label: 'Ativa',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  paused:    { label: 'Pausada',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Concluída', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

const ISSUE_STATUS: Record<string, { label: string; color: string }> = {
  todo:         { label: 'A fazer',      color: '#6b7280' },
  backlog:      { label: 'Backlog',      color: '#6b7280' },
  em_progresso: { label: 'Em andamento', color: '#3b82f6' },
  em_revisao:   { label: 'Em revisão',   color: '#f59e0b' },
  concluido:    { label: 'Concluído',    color: '#10b981' },
  cancelado:    { label: 'Cancelado',    color: '#ef4444' },
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function SquadWorkspacePage() {
  const { squadId } = useParams<{ squadId: string }>();
  const navigate = useNavigate();

  const [squad, setSquad] = useState<Squad | null>(null);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);
  const [squadAgents, setSquadAgents] = useState<Agent[]>([]);
  const [allIssues, setAllIssues] = useState<Issue[]>([]);
  const [outputs, setOutputs] = useState<Output[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tarefas' | 'entregas' | 'integracoes'>('tarefas');
  const [integReqs, setIntegReqs] = useState<IntegrationReq[]>([]);
  const [configuringInteg, setConfiguringInteg] = useState<IntegrationReq | null>(null);
  const [integForm, setIntegForm] = useState<Record<string, string>>({});
  const [savingInteg, setSavingInteg] = useState(false);
  const [integMsg, setIntegMsg] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Squad>>({});
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<string | null>(null);

  // Nova run modal
  const [showRunModal, setShowRunModal] = useState(false);
  const [runRequest, setRunRequest] = useState('');
  const [creatingRun, setCreatingRun] = useState(false);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  async function createRun() {
    if (!runRequest.trim() || !squad) return;
    setCreatingRun(true);
    setRunMsg(null);
    try {
      const leader = squad.leaderId ? squadAgents.find(a => a.id === squad.leaderId) : null;
      const pipeline = squadAgents.map(a => a.name).join(' → ');
      const description =
        `[Solicitação via Equipe ${squad.name}]\n\n` +
        `Pedido: ${runRequest.trim()}\n\n` +
        `Equipe: ${squad.name}\n` +
        `Missão: ${squad.mission || squad.description || ''}\n` +
        (pipeline ? `Pipeline sugerido: ${pipeline}\n` : '') +
        `\nOrquestre o pipeline completo criando subtarefas sequenciais para cada membro da equipe.`;
      await api.post('/issues', {
        title: `[Equipe ${squad.name}] ${runRequest.trim().slice(0, 80)}`,
        description,
        status: 'todo',
        priority: 'medio',
        assigneeAgentId: leader?.id || undefined,
        assigneeAgentName: leader?.name || undefined,
      });
      setRunMsg('✅ Tarefa criada! O CEO vai orquestrar o pipeline da equipe no próximo ciclo (até 15min).');
      setRunRequest('');
      setTimeout(() => { setShowRunModal(false); setRunMsg(null); load(); }, 3000);
    } catch {
      setRunMsg('❌ Erro ao criar tarefa. Tente novamente.');
    } finally {
      setCreatingRun(false);
    }
  }

  async function load() {
    setLoading(true);
    try {
      const [squads, agList, issues, outs, reqs] = await Promise.all([
        api.get<Squad[]>('/squads'),
        api.get<Agent[]>('/enterprise/agents').catch(() => []),
        api.get<Issue[]>('/issues').catch(() => []),
        api.get<Output[]>('/outputs').catch(() => []),
        api.get<IntegrationReq[]>('/user/integrations/requirements').catch(() => []),
      ]);
      setIntegReqs(reqs || []);
      const sq = (squads || []).find(s => s.id === squadId);
      if (!sq) { navigate('/squads'); return; }
      setSquad(sq);

      const agentMap = Object.fromEntries((agList || []).map((a: Agent) => [a.id, a]));
      setAllAgents((agList || []).filter((a: Agent) => a.status === 'active'));
      setSquadAgents(sq.agentIds.map((id: string) => agentMap[id]).filter(Boolean));

      const memberIds = new Set(sq.agentIds);
      setAllIssues((issues || []).filter((i: Issue) => i.assigneeAgentId && memberIds.has(i.assigneeAgentId)));
      setOutputs((outs || []).filter((o: Output) => o.agentId && memberIds.has(o.agentId)));
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

  function openEdit() {
    if (!squad) return;
    setEditForm({ name: squad.name, description: squad.description, mission: squad.mission, agentIds: [...squad.agentIds], leaderId: squad.leaderId || '' });
    setEditMsg(null);
    setShowEdit(true);
  }

  async function saveEdit() {
    if (!squad) return;
    setSaving(true);
    setEditMsg(null);
    try {
      const updated = await api.put<Squad>(`/squads/${squad.id}`, editForm);
      setSquad(updated);
      const agentMap = Object.fromEntries(allAgents.map(a => [a.id, a]));
      setSquadAgents((updated.agentIds || []).map((id: string) => agentMap[id]).filter(Boolean));
      setEditMsg('✅ Equipe atualizada!');
      setTimeout(() => { setShowEdit(false); setEditMsg(null); }, 1200);
    } catch (e: any) {
      setEditMsg('❌ Erro: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleMember(agentId: string) {
    setEditForm(f => {
      const ids = f.agentIds || [];
      const next = ids.includes(agentId) ? ids.filter(id => id !== agentId) : [...ids, agentId];
      const leaderId = f.leaderId && next.includes(f.leaderId) ? f.leaderId : '';
      return { ...f, agentIds: next, leaderId };
    });
  }

  async function deleteOutput(id: string) {
    if (!confirm('Remover esta entrega?')) return;
    await api.delete(`/outputs/${id}`).catch(() => {});
    setOutputs(prev => prev.filter(o => o.id !== id));
  }

  function openConfigInteg(integ: IntegrationReq) {
    setConfiguringInteg(integ);
    setIntegForm({});
    setIntegMsg(null);
  }

  async function saveInteg() {
    if (!configuringInteg) return;
    setSavingInteg(true);
    setIntegMsg(null);
    try {
      await api.put(`/user/integrations/${configuringInteg.integrationId}`, integForm);
      setIntegReqs(prev => prev.map(r => r.integrationId === configuringInteg.integrationId ? { ...r, configured: true } : r));
      setIntegMsg('✅ Salvo com sucesso!');
      setTimeout(() => { setIntegMsg(null); setConfiguringInteg(null); }, 1200);
    } catch (e: any) {
      setIntegMsg('❌ Erro: ' + e.message);
    } finally {
      setSavingInteg(false);
    }
  }

  async function disconnectInteg(integrationId: string) {
    if (!confirm('Remover esta credencial?')) return;
    try {
      await api.delete(`/user/integrations/${integrationId}`);
      setIntegReqs(prev => prev.map(r => r.integrationId === integrationId ? { ...r, configured: false } : r));
    } catch {}
  }

  if (loading) {
    return <div className="page"><div style={{ color: 'var(--muted)', padding: 40, textAlign: 'center' }}>Carregando...</div></div>;
  }
  if (!squad) return null;

  const info = STATUS_INFO[squad.status];
  const leader = squad.leaderId ? squadAgents.find(a => a.id === squad.leaderId) : null;
  const otherMembers = squadAgents.filter(a => a.id !== squad.leaderId);

  const filtered = statusFilter === 'all' ? allIssues : allIssues.filter(i => i.status === statusFilter);
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
              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: info.bg, color: info.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {info.label}
              </span>
            </div>
            {squad.description && <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--fg-2)' }}>{squad.description}</p>}
            {squad.mission && (
              <div style={{ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-2)', borderLeft: '3px solid var(--primary)', color: 'var(--fg-2)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--primary)' }}>Missão:</strong> {squad.mission}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            {leader && (
              <button onClick={() => setShowRunModal(true)} style={{ fontSize: 12, padding: '8px 16px', fontWeight: 700 }}>
                💬 Nova run
              </button>
            )}
            <button className="ghost" onClick={openEdit} style={{ fontSize: 12, padding: '8px 14px' }}>
              ✏️ Editar equipe
            </button>
            <button className="ghost" onClick={toggleStatus} disabled={togglingStatus} style={{ fontSize: 12, padding: '8px 14px' }}>
              {squad.status === 'active' ? '⏸ Pausar' : '▶ Ativar'}
            </button>
          </div>
        </div>

        {/* Membros */}
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 4 }}>Equipe:</span>
          {leader && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 20, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)', fontSize: 12 }}>
              <span>👑</span>
              <span style={{ fontWeight: 700, color: '#f59e0b' }}>{leader.name}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>— líder</span>
              <button className="ghost" style={{ padding: '1px 6px', fontSize: 10, marginLeft: 2 }} onClick={() => navigate(`/chat/${leader.id}`)}>💬</button>
            </div>
          )}
          {otherMembers.map(a => (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}
              onClick={() => navigate(`/chat/${a.id}`)}>
              <span>{agentEmoji(a.role)}</span>
              <span style={{ fontWeight: 600 }}>{a.name}</span>
            </div>
          ))}
          {squadAgents.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum membro — <button className="ghost" style={{ fontSize: 11, padding: '2px 8px' }} onClick={openEdit}>Adicionar →</button></span>}
        </div>
      </div>

      {/* Aviso equipe pausada */}
      {squad.status === 'paused' && (
        <div style={{ padding: '12px 16px', marginBottom: 20, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, fontSize: 13, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span>⏸</span>
          <span>Equipe pausada — CEO não atribui tarefas aos membros. <button className="ghost" style={{ fontSize: 12, color: '#f59e0b', padding: '2px 8px' }} onClick={toggleStatus}>Ativar →</button></span>
        </div>
      )}

      {/* Instrução de run */}
      {leader && squad.status === 'active' && (
        <div style={{ padding: '14px 18px', marginBottom: 20, background: 'rgba(146,48,249,0.07)', border: '1px solid rgba(146,48,249,0.2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--primary)', marginBottom: 3 }}>💡 Como iniciar um trabalho</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.6 }}>
              Clique em <strong>"Nova run"</strong>, descreva o que precisa e o CEO orquestra o pipeline completo da equipe automaticamente.
            </div>
          </div>
          <button onClick={() => setShowRunModal(true)} style={{ fontSize: 13, padding: '9px 20px', fontWeight: 700, flexShrink: 0 }}>
            💬 Nova run
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Em andamento', value: active,          color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
          { label: 'A fazer',      value: todo,            color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
          { label: 'Concluídas',   value: done,            color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Entregas',     value: outputs.length,  color: '#a78bfa', bg: 'rgba(167,139,250,0.1)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '14px 18px', textAlign: 'center', background: stat.bg, border: `1px solid ${stat.color}33`, cursor: stat.label === 'Entregas' ? 'pointer' : undefined }}
            onClick={stat.label === 'Entregas' ? () => setTab('entregas') : undefined}>
            <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: 12, color: 'var(--fg-2)', marginTop: 4 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Banner: integrações faltando */}
      {integReqs.some(r => !r.configured) && (
        <div style={{ padding: '10px 16px', marginBottom: 16, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <span>⚠️</span>
          <span style={{ flex: 1 }}>
            <strong style={{ color: '#ef4444' }}>Credenciais faltando:</strong>{' '}
            {integReqs.filter(r => !r.configured).map(r => r.integrationName).join(', ')} —{' '}
            as skills desta equipe podem não funcionar.
          </span>
          <button style={{ fontSize: 12, padding: '5px 12px', flexShrink: 0 }} onClick={() => setTab('integracoes')}>
            🔌 Configurar →
          </button>
        </div>
      )}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <button onClick={() => setTab('tarefas')} className={tab === 'tarefas' ? '' : 'ghost'} style={{ fontSize: 13, padding: '7px 18px' }}>
          📋 Tarefas ({allIssues.length})
        </button>
        <button onClick={() => setTab('entregas')} className={tab === 'entregas' ? '' : 'ghost'} style={{ fontSize: 13, padding: '7px 18px' }}>
          📦 Entregas ({outputs.length})
        </button>
        <button onClick={() => setTab('integracoes')} className={tab === 'integracoes' ? '' : 'ghost'} style={{ fontSize: 13, padding: '7px 18px', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔌 Integrações
          {integReqs.some(r => !r.configured) && (
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
          )}
        </button>
      </div>

      {/* --- ABA TAREFAS --- */}
      {tab === 'tarefas' && (
        <>
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['all', 'em_progresso', 'em_revisao', 'todo', 'concluido'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ fontSize: 11, padding: '4px 12px', background: statusFilter === s ? 'var(--primary)' : 'var(--bg-2)', color: statusFilter === s ? '#fff' : 'var(--fg-2)', borderColor: statusFilter === s ? 'var(--primary)' : 'var(--border)' }}>
                {s === 'all' ? `Todas (${allIssues.length})` : `${ISSUE_STATUS[s]?.label ?? s} (${allIssues.filter(i => i.status === s).length})`}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
                {allIssues.length === 0 ? 'Nenhuma tarefa ainda' : 'Nenhuma tarefa com esse filtro'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380, margin: '0 auto' }}>
                {allIssues.length === 0 ? 'Inicie uma run para o CEO orquestrar o pipeline da equipe.' : 'Tente outro filtro.'}
              </p>
              {leader && allIssues.length === 0 && (
                <button style={{ marginTop: 16 }} onClick={() => setShowRunModal(true)}>💬 Iniciar primeira run</button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(issue => {
                const st = ISSUE_STATUS[issue.status] ?? { label: issue.status, color: '#6b7280' };
                const member = squadAgents.find(a => a.id === issue.assigneeAgentId);
                const reprovalLog = (issue.logs || []).slice().reverse().find(l => l.msg.startsWith('❌ CEO reprovou:'));
                return (
                  <div key={issue.id} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${st.color}` }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{issue.title}</span>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: `${st.color}18`, color: st.color, fontWeight: 700 }}>{st.label}</span>
                        </div>
                        {reprovalLog && (
                          <div style={{ fontSize: 11, marginBottom: 6, padding: '4px 8px', borderRadius: 6, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                            ↩ CEO pediu ajuste: {reprovalLog.msg.replace('❌ CEO reprovou:', '').replace('Tarefa reaberta para correção.', '').trim().slice(0, 150)}
                          </div>
                        )}
                        {!reprovalLog && issue.description && (
                          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 6 }}>
                            {issue.description.slice(0, 120)}{issue.description.length > 120 ? '…' : ''}
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                          {member && <span style={{ cursor: 'pointer', color: 'var(--primary)' }} onClick={() => navigate(`/chat/${member.id}`)}>{agentEmoji(member.role)} {member.name}</span>}
                          <span>🕐 {new Date(issue.createdAt).toLocaleDateString('pt-BR')}</span>
                          {issue.completedAt && <span style={{ color: '#10b981' }}>✅ {new Date(issue.completedAt).toLocaleDateString('pt-BR')}</span>}
                        </div>
                      </div>
                      {member && (
                        <button className="ghost" style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0 }} onClick={() => navigate(`/chat/${member.id}`)}>💬</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* --- ABA ENTREGAS --- */}
      {tab === 'entregas' && (
        <div>
          {outputs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Nenhuma entrega ainda</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380, margin: '0 auto' }}>
                Os textos, pesquisas e documentos produzidos pelos agentes aparecem aqui automaticamente após cada tarefa concluída.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {outputs.map(out => {
                const isExpanded = expandedOutput === out.id;
                const agent = squadAgents.find(a => a.id === out.agentId);
                return (
                  <div key={out.id} className="card" style={{ padding: '14px 16px', borderLeft: '3px solid var(--primary)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: 13 }}>{out.title}</span>
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: 'rgba(146,48,249,0.12)', color: 'var(--primary)', fontWeight: 600 }}>
                            {out.type === 'text' ? '📄 Texto' : out.type === 'url' ? '🔗 Link' : out.type === 'code' ? '💻 Código' : '📝 Markdown'}
                          </span>
                        </div>

                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {out.agentName && (
                            <span style={{ cursor: agent ? 'pointer' : 'default', color: agent ? 'var(--primary)' : undefined }}
                              onClick={() => agent && navigate(`/chat/${agent.id}`)}>
                              {agent ? agentEmoji(agent.role) : '🤖'} {out.agentName}
                            </span>
                          )}
                          {out.issueTitle && <span>📋 {out.issueTitle.slice(0, 50)}</span>}
                          <span>🕐 {formatDate(out.createdAt)}</span>
                        </div>

                        <div style={{
                          fontSize: 12, lineHeight: 1.6,
                          background: 'var(--bg-2)', borderRadius: 8,
                          padding: '10px 12px',
                          maxHeight: isExpanded ? 'none' : '80px',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap',
                          color: 'var(--fg-2)',
                        }}>
                          {out.content}
                        </div>

                        {out.content.length > 200 && (
                          <button className="ghost" style={{ fontSize: 11, marginTop: 6, padding: '3px 10px' }}
                            onClick={() => setExpandedOutput(isExpanded ? null : out.id)}>
                            {isExpanded ? '▲ Recolher' : '▼ Ver tudo'}
                          </button>
                        )}
                      </div>

                      <button className="ghost" style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)', flexShrink: 0 }}
                        onClick={() => deleteOutput(out.id)} title="Remover entrega">
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* --- ABA INTEGRAÇÕES --- */}
      {tab === 'integracoes' && (
        <div>
          {integReqs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🔌</div>
              <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>Nenhuma integração necessária</p>
              <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 380, margin: '0 auto' }}>
                As skills dos agentes desta equipe não requerem APIs externas ainda.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {integReqs.map(integ => (
                <div key={integ.integrationId} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${integ.configured ? '#10b981' : '#ef4444'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{integ.integrationName}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: integ.configured ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                          color: integ.configured ? '#10b981' : '#ef4444',
                        }}>
                          {integ.configured ? '✓ Configurada' : '✗ Faltando'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Usada por: <strong>{integ.skills.join(', ')}</strong>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button className="ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openConfigInteg(integ)}>
                        ⚙️ {integ.configured ? 'Reconfigurar' : 'Configurar'}
                      </button>
                      {integ.configured && (
                        <button className="ghost" style={{ fontSize: 12, padding: '6px 10px', color: 'var(--danger)' }} onClick={() => disconnectInteg(integ.integrationId)}>
                          🗑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                <a href="/integrations" style={{ color: 'var(--primary)', textDecoration: 'none' }}>
                  Ver todas as integrações disponíveis →
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Configurar Integração */}
      {configuringInteg && (
        <div className="modal-overlay" onClick={() => setConfiguringInteg(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
            <h2 style={{ fontSize: 16, marginBottom: 6 }}>🔌 Configurar {configuringInteg.integrationName}</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
              Necessária para: <strong>{configuringInteg.skills.join(', ')}</strong>
            </p>

            {configuringInteg.fields.map(field => (
              <div key={field.key} className="form-group">
                <label>{field.label}</label>
                <input
                  type={field.type === 'password' ? 'password' : 'text'}
                  value={integForm[field.key] || ''}
                  onChange={e => setIntegForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  autoComplete="off"
                />
              </div>
            ))}

            {integMsg && (
              <div style={{ marginBottom: 12, fontSize: 13, color: integMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>
                {integMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setConfiguringInteg(null)}>Cancelar</button>
              <button onClick={saveInteg} disabled={savingInteg}>
                {savingInteg ? 'Salvando...' : '🔒 Salvar credenciais'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Equipe */}
      {showEdit && (
        <div className="modal-overlay" onClick={() => setShowEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 16, marginBottom: 20 }}>✏️ Editar Equipe</h2>

            <div className="form-group">
              <label>Nome da equipe *</label>
              <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Grandense" autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <input value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Resumo do propósito da equipe" />
            </div>
            <div className="form-group">
              <label>Missão</label>
              <textarea value={editForm.mission || ''} onChange={e => setEditForm(f => ({ ...f, mission: e.target.value }))} placeholder="O que esta equipe deve alcançar?" rows={3} style={{ resize: 'vertical' }} />
            </div>

            <div className="form-group">
              <label>Membros da equipe</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px' }}>
                {allAgents.length === 0 && <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum agente ativo</span>}
                {allAgents.map(a => {
                  const selected = (editForm.agentIds || []).includes(a.id);
                  return (
                    <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, background: selected ? 'rgba(146,48,249,0.08)' : undefined }}>
                      <input type="checkbox" checked={selected} onChange={() => toggleMember(a.id)} />
                      <span>{agentEmoji(a.role)}</span>
                      <span style={{ fontWeight: selected ? 600 : 400 }}>{a.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{a.role}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {(editForm.agentIds || []).length > 0 && (
              <div className="form-group">
                <label>Líder da equipe</label>
                <select value={editForm.leaderId || ''} onChange={e => setEditForm(f => ({ ...f, leaderId: e.target.value }))}>
                  <option value="">— Sem líder definido —</option>
                  {(editForm.agentIds || []).map(id => {
                    const a = allAgents.find(ag => ag.id === id);
                    return a ? <option key={id} value={id}>👑 {a.name} — {a.role}</option> : null;
                  })}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Status</label>
              <select value={editForm.status || 'active'} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Squad['status'] }))}>
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="completed">Concluída</option>
              </select>
            </div>

            {editMsg && (
              <div style={{ marginBottom: 12, fontSize: 13, color: editMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{editMsg}</div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowEdit(false)}>Cancelar</button>
              <button onClick={saveEdit} disabled={saving || !editForm.name}>
                {saving ? 'Salvando...' : '💾 Salvar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Run */}
      {showRunModal && squad && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={e => { if (e.target === e.currentTarget) { setShowRunModal(false); setRunMsg(null); setRunRequest(''); } }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, padding: 28, borderRadius: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 17 }}>💬 Nova run — {squad.name}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  O CEO orquestra o pipeline completo da equipe automaticamente.
                </div>
              </div>
              <button className="ghost" onClick={() => { setShowRunModal(false); setRunMsg(null); setRunRequest(''); }} style={{ fontSize: 18, padding: '2px 8px', lineHeight: 1 }}>×</button>
            </div>

            {squadAgents.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                {squadAgents.map((a, i) => (
                  <span key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--fg-2)' }}>
                      {agentEmoji(a.role)} {a.name.split(' / ')[0]}
                    </span>
                    {i < squadAgents.length - 1 && <span style={{ fontSize: 10, color: 'var(--muted)' }}>→</span>}
                  </span>
                ))}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600, fontSize: 13 }}>O que você precisa?</label>
              <textarea
                value={runRequest}
                onChange={e => setRunRequest(e.target.value)}
                placeholder={`Ex: Crie um vídeo de 1 minuto sobre casos paranormais verificáveis no Brasil`}
                rows={4}
                style={{ width: '100%', marginTop: 6, resize: 'vertical', fontSize: 13 }}
                autoFocus
              />
            </div>

            {runMsg && (
              <div style={{ marginBottom: 12, fontSize: 13, color: runMsg.startsWith('✅') ? '#10b981' : '#ef4444' }}>{runMsg}</div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => { setShowRunModal(false); setRunMsg(null); setRunRequest(''); }} style={{ fontSize: 13 }}>
                Cancelar
              </button>
              <button
                onClick={createRun}
                disabled={!runRequest.trim() || creatingRun}
                style={{ fontSize: 13, padding: '8px 20px', fontWeight: 700 }}
              >
                {creatingRun ? 'Criando...' : '🚀 Iniciar pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
