import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

type TarefaStatus = 'backlog' | 'todo' | 'em_progresso' | 'em_revisao' | 'concluido' | 'cancelado';
type TarefaPriority = 'critico' | 'alto' | 'medio' | 'baixo';

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
  { key: 'backlog', label: 'Pendente' },
];

const BLANK_FORM = {
  title: '', description: '', status: 'todo' as TarefaStatus,
  priority: 'medio' as TarefaPriority, assigneeAgentId: '',
  requiresApproval: false,
};

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

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK_FORM });
    setShowForm(true);
  }

  function openEdit(issue: Tarefa) {
    setEditingId(issue.id);
    setForm({
      title: issue.title,
      description: issue.description,
      status: issue.status,
      priority: issue.priority,
      assigneeAgentId: issue.assigneeAgentId || '',
      requiresApproval: issue.requiresApproval,
    });
    setShowForm(true);
  }

  async function save() {
    if (!form.title) return;
    setSaving(true);
    try {
      const agent = agents.find(a => a.id === form.assigneeAgentId);
      const payload = {
        ...form,
        assigneeAgentName: agent?.name,
      };
      if (editingId) {
        await api.put(`/issues/${editingId}`, payload);
      } else {
        await api.post('/issues', payload);
      }
      await load();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
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

  const displayed = filter ? issues.filter(i => i.status === filter) : issues;

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

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {FILTER_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={filter === t.key ? '' : 'ghost'}
            style={{ fontSize: 12, padding: '5px 12px' }}
          >
            {t.label}
            {t.key === '' && <span style={{ marginLeft: 6, opacity: 0.6 }}>{issues.length}</span>}
            {t.key !== '' && (
              <span style={{ marginLeft: 6, opacity: 0.6 }}>
                {issues.filter(i => i.status === t.key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>Carregando...</div>
      ) : displayed.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            {filter ? 'Nenhuma issue com este filtro.' : 'Nenhuma issue ainda.'}
          </p>
          {!filter && <button style={{ marginTop: 12 }} onClick={openNew}>Criar primeira issue</button>}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {displayed.map(issue => (
            <div key={issue.id} className="card" style={{ padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Status dot */}
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_COLORS[issue.status],
                }} />

                {/* Título + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{issue.title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {PRIORITY_LABELS[issue.priority]}
                    </span>
                    {issue.assigneeAgentName && (
                      <span
                        style={{ fontSize: 11, color: 'var(--primary)', cursor: 'pointer' }}
                        onClick={() => navigate(`/chat/${issue.assigneeAgentId}`)}
                      >
                        → {issue.assigneeAgentName}
                      </span>
                    )}
                    {issue.createdByAgentName && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                        por {issue.createdByAgentName}
                      </span>
                    )}
                    {issue.requiresApproval && issue.approvalStatus === 'pendente' && (
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 10,
                        background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)',
                      }}>⏳ Aguardando aprovação</span>
                    )}
                    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                      {new Date(issue.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {/* Status selector */}
                <select
                  value={issue.status}
                  onChange={e => updateStatus(issue.id, e.target.value as TarefaStatus)}
                  style={{
                    fontSize: 11, padding: '4px 8px', borderRadius: 6,
                    background: STATUS_COLORS[issue.status] + '22',
                    border: `1px solid ${STATUS_COLORS[issue.status]}55`,
                    color: STATUS_COLORS[issue.status], fontWeight: 600,
                  }}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                <button className="ghost" style={{ fontSize: 12, padding: '4px 8px' }} onClick={() => openEdit(issue)}>✏️</button>
                <button className="ghost" style={{ fontSize: 12, padding: '4px 8px', color: 'var(--danger)' }} onClick={() => remove(issue.id)}>🗑</button>
              </div>
              {issue.description && (
                <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)', paddingLeft: 22 }}>
                  {issue.description}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 520 }}>
            <h2>{editingId ? 'Editar Tarefa' : 'Nova Tarefa'}</h2>

            <div className="form-group">
              <label>Título *</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="O que precisa ser feito?"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Contexto adicional..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
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
              <input
                type="checkbox"
                checked={form.requiresApproval}
                onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))}
              />
              Requer aprovação antes de iniciar
            </label>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button onClick={save} disabled={!form.title || saving}>
                {saving ? 'Salvando...' : editingId ? 'Salvar' : 'Criar Tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
