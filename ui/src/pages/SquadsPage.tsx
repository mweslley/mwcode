import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Agent { id: string; name: string; role: string; status: string; }

interface Squad {
  id: string;
  name: string;
  description: string;
  mission: string;
  agentIds: string[];
  status: 'active' | 'paused' | 'completed';
  createdAt: string;
  updatedAt: string;
}

const BLANK: Omit<Squad, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', description: '', mission: '', agentIds: [], status: 'active',
};

const STATUS_INFO = {
  active:    { label: 'Ativo',     color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  paused:    { label: 'Pausado',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Concluído', color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo')) return '👔';
  if (r.includes('dev') || r.includes('eng') || r.includes('código')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  if (r.includes('qa') || r.includes('test')) return '🧪';
  return '🤖';
}

export function SquadsPage() {
  const [squads, setSquads] = useState<Squad[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Squad | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [sq, ag] = await Promise.all([
      api.get<Squad[]>('/squads').catch(() => []),
      api.get<Agent[]>('/enterprise/agents').catch(() => []),
    ]);
    setSquads(sq || []);
    setAgents((ag || []).filter((a: Agent) => a.status === 'active'));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ ...BLANK });
    setError(null);
    setShowModal(true);
  }

  function openEdit(sq: Squad) {
    setEditing(sq);
    setForm({
      name: sq.name, description: sq.description,
      mission: sq.mission, agentIds: sq.agentIds, status: sq.status,
    });
    setError(null);
    setShowModal(true);
  }

  async function save() {
    if (!form.name) { setError('Nome é obrigatório'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await api.put(`/squads/${editing.id}`, form);
      } else {
        await api.post('/squads', form);
      }
      setShowModal(false);
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string, name: string) {
    if (!confirm(`Excluir squad "${name}"?`)) return;
    await api.delete(`/squads/${id}`).catch(() => {});
    setSquads(prev => prev.filter(s => s.id !== id));
  }

  async function toggleStatus(sq: Squad) {
    const next = sq.status === 'active' ? 'paused' : 'active';
    await api.put(`/squads/${sq.id}`, { status: next }).catch(() => {});
    setSquads(prev => prev.map(s => s.id === sq.id ? { ...s, status: next } : s));
  }

  function toggleAgent(id: string) {
    setForm(f => ({
      ...f,
      agentIds: f.agentIds.includes(id)
        ? f.agentIds.filter(a => a !== id)
        : [...f.agentIds, id],
    }));
  }

  const agentById = Object.fromEntries(agents.map(a => [a.id, a]));

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-title">👥 Squads</h1>
            <p className="page-subtitle">Agrupe agentes em times especializados com missões definidas.</p>
          </div>
          <button onClick={openCreate}>+ Criar Squad</button>
        </div>
      </div>

      {/* Banner informativo */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '12px 16px', marginBottom: 24,
        background: 'rgba(146,48,249,0.08)', border: '1px solid rgba(146,48,249,0.2)',
        borderRadius: 10,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--primary)' }}>Como funciona:</strong> Um Squad é um time de agentes com uma missão em comum.
          O CEO pode atribuir tarefas ao squad inteiro, e qualquer membro pode executá-las.
          Squads são ideais para projetos específicos — ex: "Time de Lançamento", "Suporte ao Cliente", "Squad de Conteúdo".
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Carregando...</div>
      ) : squads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>Nenhum squad criado</h3>
          <p>Agrupe seus agentes em times especializados para projetos e missões específicas.</p>
          <button style={{ marginTop: 16 }} onClick={openCreate}>+ Criar primeiro squad</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {squads.map(sq => {
            const info = STATUS_INFO[sq.status];
            const members = sq.agentIds.map(id => agentById[id]).filter(Boolean);
            return (
              <div key={sq.id} className="card" style={{
                padding: 0, overflow: 'hidden',
                borderLeft: `3px solid ${info.color}`,
              }}>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Nome + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{sq.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: info.bg, color: info.color,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {info.label}
                        </span>
                      </div>

                      {sq.description && (
                        <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 8 }}>
                          {sq.description}
                        </div>
                      )}

                      {sq.mission && (
                        <div style={{
                          fontSize: 12, color: 'var(--muted)',
                          padding: '6px 10px', background: 'var(--bg-2)',
                          borderRadius: 6, marginBottom: 10,
                          borderLeft: '2px solid var(--primary)',
                        }}>
                          <strong style={{ color: 'var(--fg-2)' }}>Missão:</strong> {sq.mission}
                        </div>
                      )}

                      {/* Membros */}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        {members.length === 0 ? (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Nenhum agente atribuído</span>
                        ) : members.map(a => (
                          <div key={a.id} style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '3px 8px', background: 'var(--bg-2)',
                            border: '1px solid var(--border)', borderRadius: 20,
                            fontSize: 11,
                          }}>
                            <span>{agentEmoji(a.role)}</span>
                            <span style={{ fontWeight: 600 }}>{a.name}</span>
                          </div>
                        ))}
                        {sq.agentIds.length > members.length && (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            +{sq.agentIds.length - members.length} inativo{sq.agentIds.length - members.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="ghost"
                        style={{ fontSize: 11, padding: '5px 10px' }}
                        onClick={() => toggleStatus(sq)}
                        title={sq.status === 'active' ? 'Pausar squad' : 'Ativar squad'}
                      >
                        {sq.status === 'active' ? '⏸' : '▶'}
                      </button>
                      <button
                        className="ghost"
                        style={{ fontSize: 11, padding: '5px 10px' }}
                        onClick={() => openEdit(sq)}
                      >
                        ✏️
                      </button>
                      <button
                        className="ghost"
                        style={{ fontSize: 11, padding: '5px 10px', color: 'var(--danger)' }}
                        onClick={() => remove(sq.id, sq.name)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>

                {/* Rodapé com meta */}
                <div style={{
                  padding: '8px 18px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-2)',
                  display: 'flex', gap: 16,
                  fontSize: 11, color: 'var(--muted)',
                }}>
                  <span>👥 {members.length} membro{members.length !== 1 ? 's' : ''}</span>
                  <span>🕐 Criado {new Date(sq.createdAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 540, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>{editing ? `✏️ Editar squad — ${editing.name}` : '👥 Criar Squad'}</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Nome do Squad *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Time de Lançamento, Squad de Suporte..."
                  autoFocus
                />
              </div>
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="O que esse squad faz?"
              />
            </div>

            <div className="form-group">
              <label>Missão atual</label>
              <textarea
                value={form.mission}
                onChange={e => setForm(f => ({ ...f, mission: e.target.value }))}
                placeholder="Ex: Lançar campanha de marketing Q2, atingir 1000 clientes em 30 dias..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Status</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {(Object.entries(STATUS_INFO) as [string, typeof STATUS_INFO['active']][]).map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: key as Squad['status'] }))}
                    style={{
                      fontSize: 12, padding: '5px 14px',
                      background: form.status === key ? info.bg : 'var(--bg-2)',
                      color: form.status === key ? info.color : 'var(--fg-2)',
                      borderColor: form.status === key ? info.color : 'var(--border)',
                    }}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>Agentes do Squad</label>
              {agents.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                  Nenhum agente ativo disponível.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
                  {agents.map(a => {
                    const sel = form.agentIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAgent(a.id)}
                        style={{
                          padding: '6px 12px', fontSize: 12, borderRadius: 20,
                          border: `1px solid ${sel ? 'var(--primary)' : 'var(--border)'}`,
                          background: sel ? 'rgba(146,48,249,0.15)' : 'var(--bg-2)',
                          color: sel ? 'var(--primary)' : 'var(--fg-2)',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        {agentEmoji(a.role)} {a.name}
                        {sel && <span style={{ fontWeight: 700 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.agentIds.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  {form.agentIds.length} agente{form.agentIds.length > 1 ? 's' : ''} selecionado{form.agentIds.length > 1 ? 's' : ''}
                </div>
              )}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button onClick={save} disabled={saving || !form.name}>
                {saving ? 'Salvando...' : editing ? '💾 Salvar' : '👥 Criar Squad'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
