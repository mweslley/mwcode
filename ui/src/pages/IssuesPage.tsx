import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type TarefaStatus = 'backlog' | 'todo' | 'em_progresso' | 'em_revisao' | 'concluido' | 'cancelado';
type TarefaPriority = 'critico' | 'alto' | 'medio' | 'baixo';

interface LogEntry { ts: string; msg: string; ok?: boolean; }

interface Tarefa {
  id: string;
  title: string;
  description: string;
  status: TarefaStatus;
  priority: TarefaPriority;
  assigneeAgentId?: string;
  assigneeAgentName?: string;
  createdByAgentName?: string;
  requiresApproval: boolean;
  approvalStatus?: 'pendente' | 'aprovado' | 'rejeitado';
  approvalType?: 'contratar' | 'foco' | 'geral';
  hireData?: { name: string; role: string; instructions: string; model: string };
  focusData?: { mission?: string; goals?: string[] };
  paused?: boolean;
  logs?: LogEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface Agent { id: string; name: string; role: string; status: string; }

const STATUS_LABELS: Record<TarefaStatus, string> = {
  backlog: 'Pendente', todo: 'A fazer', em_progresso: 'Em progresso',
  em_revisao: 'Em revisão', concluido: 'Concluído', cancelado: 'Cancelado',
};
const STATUS_COLORS: Record<TarefaStatus, string> = {
  backlog: '#6b7280', todo: '#9230f9', em_progresso: '#f59e0b',
  em_revisao: '#3b82f6', concluido: '#10b981', cancelado: '#ef4444',
};
const PRIORITY_LABELS: Record<TarefaPriority, string> = {
  critico: '🔴 Crítico', alto: '🟠 Alto', medio: '🟡 Médio', baixo: '⚪ Baixo',
};

const FILTER_TABS = [
  { key: '', label: 'Todas' },
  { key: 'todo', label: 'A fazer' },
  { key: 'em_progresso', label: 'Em progresso' },
  { key: 'em_revisao', label: 'Em revisão' },
  { key: 'concluido', label: 'Concluídas' },
  { key: 'reprovadas', label: '↩ Ajustes' },
  { key: 'backlog', label: 'Pendente' },
  { key: 'aprovacao', label: '⏳ Aprovações' },
];

function extractReprovalReason(logs?: LogEntry[]): string | null {
  if (!logs) return null;
  const entry = [...logs].reverse().find(l => l.msg.startsWith('❌ CEO reprovou:'));
  if (!entry) return null;
  return entry.msg
    .replace('❌ CEO reprovou:', '')
    .replace('Tarefa reaberta para correção.', '')
    .trim();
}

function getWorkerOutput(logs?: LogEntry[]): string | null {
  if (!logs) return null;
  // Última mensagem de agente (não é log do sistema)
  const entry = [...logs].reverse().find(l =>
    !l.msg.startsWith('❌') && !l.msg.startsWith('✅') &&
    !l.msg.startsWith('Criada') && !l.msg.startsWith('Status') &&
    !l.msg.startsWith('CEO') && l.msg.length > 20
  );
  return entry?.msg || null;
}

function getCEOApprovalNote(logs?: LogEntry[]): string | null {
  if (!logs) return null;
  const entry = [...logs].reverse().find(l => l.msg.includes('CEO revisou e aprovou'));
  return entry ? entry.msg : null;
}

const BLANK_FORM = {
  title: '', description: '', status: 'todo' as TarefaStatus,
  priority: 'medio' as TarefaPriority, assigneeAgentId: '',
  requiresApproval: false,
};

function formatTs(iso: string) {
  try { return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return iso; }
}

export function TarefasPage() {
  const navigate = useNavigate();
  const [issues, setTarefas] = useState<Tarefa[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [logIssue, setLogIssue] = useState<Tarefa | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string; title: string } | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [approving, setApproving] = useState<string | null>(null);

  async function load() {
    const [list, agList] = await Promise.all([
      api.get<Tarefa[]>('/issues').catch(() => []),
      api.get<Agent[]>('/enterprise/agents').catch(() => []),
    ]);
    setTarefas(list || []);
    setAgents((agList || []).filter((a: Agent) => a.status === 'active'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openNew() { setEditingId(null); setForm({ ...BLANK_FORM }); setShowForm(true); }
  function openEdit(issue: Tarefa) {
    setEditingId(issue.id);
    setForm({ title: issue.title, description: issue.description, status: issue.status,
      priority: issue.priority, assigneeAgentId: issue.assigneeAgentId || '', requiresApproval: issue.requiresApproval });
    setShowForm(true);
  }

  async function save() {
    if (!form.title) return;
    setSaving(true);
    try {
      const agent = agents.find(a => a.id === form.assigneeAgentId);
      const payload = { ...form, assigneeAgentName: agent?.name };
      if (editingId) await api.put(`/issues/${editingId}`, payload);
      else await api.post('/issues', payload);
      await load();
      setShowForm(false);
    } finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: TarefaStatus) {
    await api.put(`/issues/${id}`, { status }).catch(() => {});
    setTarefas(prev => prev.map(i => i.id === id ? { ...i, status } : i));
  }

  async function remove(id: string) {
    if (!confirm('Deletar esta issue?')) return;
    await api.delete(`/issues/${id}`).catch(() => {});
    setTarefas(prev => prev.filter(i => i.id !== id));
  }

  async function togglePause(id: string) {
    const updated = await api.post<Tarefa>(`/issues/${id}/pause`, {}).catch(() => null);
    if (updated) setTarefas(prev => prev.map(i => i.id === id ? updated : i));
  }

  async function approve(id: string) {
    setApproving(id);
    try {
      const updated = await api.post<Tarefa>(`/issues/${id}/approve`, {});
      setTarefas(prev => prev.map(i => i.id === id ? updated : i));
      await load(); // reload to show new agent if hired
    } catch (e: any) {
      alert('Erro ao aprovar: ' + e.message);
    } finally { setApproving(null); }
  }

  async function reject(id: string) {
    setApproving(id);
    try {
      const updated = await api.post<Tarefa>(`/issues/${id}/reject`, { note: rejectNote });
      setTarefas(prev => prev.map(i => i.id === id ? updated : i));
      setRejectModal(null);
      setRejectNote('');
    } catch (e: any) {
      alert('Erro ao rejeitar: ' + e.message);
    } finally { setApproving(null); }
  }

  const pendingApprovals = issues.filter(i => i.requiresApproval && i.approvalStatus === 'pendente');
  const reproved = issues.filter(i => i.status === 'todo' && extractReprovalReason(i.logs) !== null);

  const displayed = filter === 'aprovacao'
    ? pendingApprovals
    : filter === 'reprovadas'
    ? reproved
    : filter ? issues.filter(i => i.status === filter) : issues;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Tarefas</h1>
            <p className="page-subtitle">Tarefas, delegações e acompanhamento do trabalho dos agentes.</p>
          </div>
          <button onClick={openNew}>+ Nova Tarefa</button>
        </div>
      </div>

      {/* Aprovações pendentes — banner de destaque */}
      {pendingApprovals.length > 0 && (
        <div style={{
          background: 'rgba(146,48,249,0.08)', border: '1px solid rgba(146,48,249,0.3)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⏳</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            <strong>{pendingApprovals.length}</strong> {pendingApprovals.length === 1 ? 'solicitação aguarda' : 'solicitações aguardam'} sua aprovação
          </span>
          <button style={{ fontSize: 12, padding: '4px 12px' }} onClick={() => setFilter('aprovacao')}>
            Ver todas →
          </button>
        </div>
      )}

      {/* Banner de ajustes pedidos pelo CEO */}
      {reproved.length > 0 && filter !== 'reprovadas' && (
        <div style={{
          background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 8, padding: '10px 14px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>↩</span>
          <span style={{ fontSize: 13, flex: 1 }}>
            <strong>{reproved.length}</strong> {reproved.length === 1 ? 'tarefa foi reprovada pelo CEO' : 'tarefas foram reprovadas pelo CEO'} e {reproved.length === 1 ? 'aguarda' : 'aguardam'} correção
          </span>
          <button style={{ fontSize: 12, padding: '4px 12px', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }} onClick={() => setFilter('reprovadas')}>
            Ver ajustes →
          </button>
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={filter === t.key ? '' : 'ghost'}
            style={{
              fontSize: 12, padding: '5px 12px',
              ...(t.key === 'reprovadas' && reproved.length > 0 && filter !== 'reprovadas'
                ? { borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444' } : {}),
            }}
          >
            {t.label}
            <span style={{ marginLeft: 6, opacity: 0.6 }}>
              {t.key === 'aprovacao' ? pendingApprovals.length
                : t.key === 'reprovadas' ? reproved.length
                : t.key === '' ? issues.length
                : issues.filter(i => i.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>Carregando...</div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {filter === 'aprovacao' ? 'Nenhuma solicitação pendente.' : filter ? 'Nenhuma issue com este filtro.' : 'Nenhuma issue ainda.'}
          </p>
          {!filter && <button style={{ marginTop: 12 }} onClick={openNew}>Criar primeira issue</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayed.map(issue => {
            const isPendingApproval = issue.requiresApproval && issue.approvalStatus === 'pendente';
            const isHire = issue.approvalType === 'contratar';
            const isFocus = issue.approvalType === 'foco';

            // Card de aprovação — visual diferenciado
            if (isPendingApproval) {
              return (
                <div key={issue.id} className="card" style={{
                  padding: '14px 16px',
                  borderColor: isHire ? 'rgba(146,48,249,0.4)' : isFocus ? 'rgba(0,188,138,0.4)' : 'rgba(245,158,11,0.4)',
                  background: isHire ? 'rgba(146,48,249,0.04)' : isFocus ? 'rgba(0,188,138,0.04)' : 'rgba(245,158,11,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>
                      {isHire ? '🤝' : isFocus ? '💡' : '⚠️'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{issue.title}</div>
                      {issue.description && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, whiteSpace: 'pre-wrap' }}>
                          {issue.description.slice(0, 300)}{issue.description.length > 300 ? '...' : ''}
                        </div>
                      )}
                      {isHire && issue.hireData && (
                        <div style={{ fontSize: 11, padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 6, marginBottom: 8 }}>
                          <strong>Cargo:</strong> {issue.hireData.role}<br />
                          <strong>Modelo:</strong> {issue.hireData.model}<br />
                          {issue.hireData.instructions && (
                            <><strong>Instruções:</strong> {issue.hireData.instructions.slice(0, 150)}{issue.hireData.instructions.length > 150 ? '...' : ''}</>
                          )}
                        </div>
                      )}
                      {isFocus && issue.focusData && (
                        <div style={{ fontSize: 11, padding: '6px 10px', background: 'var(--bg-3)', borderRadius: 6, marginBottom: 8 }}>
                          {issue.focusData.mission && <><strong>Nova missão:</strong> {issue.focusData.mission}<br /></>}
                          {issue.focusData.goals?.length ? (
                            <><strong>Novos objetivos:</strong> {issue.focusData.goals.join('; ')}</>
                          ) : null}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          style={{ fontSize: 12, padding: '5px 14px', background: 'rgba(0,188,138,0.15)', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                          onClick={() => approve(issue.id)}
                          disabled={approving === issue.id}
                        >
                          {approving === issue.id ? '...' : '✅ Aprovar'}
                        </button>
                        <button
                          className="ghost"
                          style={{ fontSize: 12, padding: '5px 14px', color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.4)' }}
                          onClick={() => { setRejectModal({ id: issue.id, title: issue.title }); setRejectNote(''); }}
                          disabled={approving === issue.id}
                        >
                          ❌ Rejeitar
                        </button>
                        <button
                          className="ghost"
                          style={{ fontSize: 11, padding: '5px 10px', color: 'var(--muted)' }}
                          onClick={() => setLogIssue(issue)}
                        >
                          📋 Log
                        </button>
                        <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center', marginLeft: 'auto' }}>
                          {issue.createdByAgentName} · {formatTs(issue.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Card normal de tarefa
            const reprovalReason = extractReprovalReason(issue.logs);
            const isReproved = reprovalReason !== null && issue.status === 'todo';
            const ceoApprovalNote = issue.status === 'concluido' ? getCEOApprovalNote(issue.logs) : null;
            const workerOutput = issue.status === 'concluido' ? getWorkerOutput(issue.logs) : null;

            return (
              <div key={issue.id} className="card" style={{
                padding: '10px 16px',
                opacity: issue.paused ? 0.65 : 1,
                borderColor: isReproved ? 'rgba(239,68,68,0.35)'
                  : issue.status === 'concluido' ? 'rgba(16,185,129,0.25)'
                  : issue.status === 'em_revisao' ? 'rgba(59,130,246,0.25)'
                  : issue.paused ? 'rgba(245,158,11,0.35)' : undefined,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Status dot */}
                  <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: isReproved ? '#ef4444' : STATUS_COLORS[issue.status] }} />

                  {/* Título + meta — clicável para ver log */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{ fontWeight: 600, fontSize: 13, marginBottom: 2, cursor: 'pointer' }}
                      onClick={() => setLogIssue(issue)}
                      title="Clique para ver o log completo"
                    >
                      {issue.paused && <span style={{ fontSize: 10, color: '#f59e0b', marginRight: 6 }}>⏸</span>}
                      {isReproved && <span style={{ fontSize: 10, color: '#ef4444', marginRight: 6 }}>↩</span>}
                      {issue.title}
                      {issue.logs && issue.logs.length > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace' }}>
                          [{issue.logs.length}]
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{PRIORITY_LABELS[issue.priority]}</span>
                      {issue.assigneeAgentName && (
                        <span
                          style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer' }}
                          onClick={() => navigate(`/chat/${issue.assigneeAgentId}`)}
                        >
                          → {issue.assigneeAgentName}
                        </span>
                      )}
                      {issue.createdByAgentName && (
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>por {issue.createdByAgentName}</span>
                      )}
                      {issue.requiresApproval && issue.approvalStatus === 'pendente' && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
                          ⏳ Aguardando aprovação
                        </span>
                      )}
                      {issue.status === 'em_revisao' && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}>
                          CEO revisando...
                        </span>
                      )}
                      {ceoApprovalNote && (
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                          ✅ CEO aprovou
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                        {new Date(issue.updatedAt || issue.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Status selector */}
                  <select
                    value={issue.status}
                    onChange={e => updateStatus(issue.id, e.target.value as TarefaStatus)}
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 6, width: 'auto', flexShrink: 0,
                      background: STATUS_COLORS[issue.status] + '22',
                      border: `1px solid ${STATUS_COLORS[issue.status]}55`,
                      color: STATUS_COLORS[issue.status], fontWeight: 600,
                    }}
                  >
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>

                  {/* Pause */}
                  <button
                    className="ghost"
                    title={issue.paused ? 'Retomar tarefa' : 'Pausar tarefa'}
                    style={{ fontSize: 12, padding: '4px 8px', color: issue.paused ? '#f59e0b' : 'var(--muted)' }}
                    onClick={() => togglePause(issue.id)}
                  >
                    {issue.paused ? '▶️' : '⏸'}
                  </button>

                  <button className="ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openEdit(issue)}>✏️</button>
                  <button className="ghost" style={{ fontSize: 12, padding: '4px 8px', color: 'var(--danger)' }} onClick={() => remove(issue.id)}>🗑</button>
                </div>

                {/* Motivo de reprovação — visível diretamente no card */}
                {isReproved && reprovalReason && (
                  <div style={{
                    marginTop: 8, marginLeft: 22,
                    padding: '7px 10px', borderRadius: 6,
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    fontSize: 12,
                  }}>
                    <span style={{ color: '#ef4444', fontWeight: 600, marginRight: 6 }}>↩ CEO pediu ajuste:</span>
                    <span style={{ color: 'var(--muted)' }}>{reprovalReason.slice(0, 250)}{reprovalReason.length > 250 ? '...' : ''}</span>
                  </div>
                )}

                {/* Entrega do worker em tarefas concluídas */}
                {issue.status === 'concluido' && workerOutput && (
                  <div style={{
                    marginTop: 8, marginLeft: 22,
                    padding: '7px 10px', borderRadius: 6,
                    background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)',
                    fontSize: 12, color: 'var(--muted)',
                  }}>
                    <span style={{ color: '#10b981', fontWeight: 600, marginRight: 6 }}>Entrega:</span>
                    {workerOutput.slice(0, 250)}{workerOutput.length > 250 ? '...' : ''}
                  </div>
                )}

                {/* Descrição — só para tarefas sem destaque especial */}
                {!isReproved && issue.status !== 'concluido' && issue.description && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', paddingLeft: 22 }}>
                    {issue.description.slice(0, 200)}{issue.description.length > 200 ? '...' : ''}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal criar/editar */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
            <h2>{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>
            <div className="form-group">
              <label>Título *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="O que precisa ser feito?" autoFocus />
            </div>
            <div className="form-group">
              <label>Descrição</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Contexto adicional..." rows={3} style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TarefaStatus }))}>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Prioridade</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TarefaPriority }))}>
                  {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Atribuir a (agente)</label>
              <select value={form.assigneeAgentId} onChange={e => setForm(f => ({ ...f, assigneeAgentId: e.target.value }))}>
                <option value="">— Sem atribuição —</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
              <input type="checkbox" checked={form.requiresApproval} onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))} />
              Requer aprovação antes de iniciar
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button onClick={save} disabled={!form.title || saving}>{saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Tarefa'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal log da tarefa — console style */}
      {logIssue && (
        <div className="modal-overlay" onClick={() => setLogIssue(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 640, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 15, marginBottom: 2 }}>📋 {logIssue.title}</h2>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {STATUS_LABELS[logIssue.status]} · {PRIORITY_LABELS[logIssue.priority]}
                  {logIssue.assigneeAgentName ? ` · → ${logIssue.assigneeAgentName}` : ''}
                </span>
              </div>
              <button className="ghost" style={{ padding: '4px 10px', fontSize: 13 }} onClick={() => setLogIssue(null)}>✕</button>
            </div>

            {logIssue.description && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, padding: '8px 10px', background: 'var(--bg-3)', borderRadius: 6 }}>
                {logIssue.description}
              </div>
            )}

            {/* Console de logs */}
            <div style={{
              flex: 1, overflowY: 'auto', minHeight: 120,
              background: '#09091a', border: '1px solid var(--border)',
              borderRadius: 8, padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            }}>
              {!logIssue.logs?.length ? (
                <span style={{ color: '#555' }}>// sem eventos registrados</span>
              ) : logIssue.logs.map((entry, i) => (
                <div key={i} style={{ marginBottom: 4, lineHeight: 1.5 }}>
                  <span style={{ color: '#555', marginRight: 8 }}>{formatTs(entry.ts)}</span>
                  <span style={{ color: entry.ok === false ? '#ef4444' : '#10b981', marginRight: 6 }}>
                    {entry.ok === false ? '✗' : '✓'}
                  </span>
                  <span style={{ color: '#e2e8f0' }}>{entry.msg}</span>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {logIssue.requiresApproval && logIssue.approvalStatus === 'pendente' && (
                <>
                  <button
                    style={{ fontSize: 12, background: 'rgba(0,188,138,0.15)', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                    onClick={() => { approve(logIssue.id); setLogIssue(null); }}
                  >
                    ✅ Aprovar
                  </button>
                  <button
                    className="ghost"
                    style={{ fontSize: 12, color: 'var(--danger)', borderColor: 'rgba(244,63,94,0.4)' }}
                    onClick={() => { setRejectModal({ id: logIssue.id, title: logIssue.title }); setLogIssue(null); }}
                  >
                    ❌ Rejeitar
                  </button>
                </>
              )}
              <button className="ghost" style={{ fontSize: 12 }} onClick={() => setLogIssue(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rejeitar */}
      {rejectModal && (
        <div className="modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 420 }}>
            <h2 style={{ fontSize: 15, marginBottom: 12 }}>Rejeitar: {rejectModal.title}</h2>
            <div className="form-group">
              <label>Motivo (opcional)</label>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="Por que está rejeitando? (deixe em branco para rejeitar sem nota)"
                rows={3}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setRejectModal(null)}>Cancelar</button>
              <button
                style={{ background: 'rgba(244,63,94,0.15)', borderColor: 'rgba(244,63,94,0.4)', color: 'var(--danger)' }}
                onClick={() => reject(rejectModal.id)}
                disabled={approving !== null}
              >
                ❌ Confirmar rejeição
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
