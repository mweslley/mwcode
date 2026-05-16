import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Agent { id: string; name: string; role: string; status: string; }

interface Equipe {
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

const BLANK: Omit<Equipe, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '', description: '', mission: '', agentIds: [], leaderId: '', status: 'active',
};

const STATUS_INFO = {
  active:    { label: 'Ativa',      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
  paused:    { label: 'Pausada',    color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  completed: { label: 'Concluída',  color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
};

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo')) return '👔';
  if (r.includes('coo')) return '🏭';
  if (r.includes('cto')) return '⚙️';
  if (r.includes('cmo')) return '📢';
  if (r.includes('cfo')) return '💰';
  if (r.includes('pesquisa') || r.includes('research') || r.includes('pauta')) return '🔍';
  if (r.includes('roteiro') || r.includes('script') || r.includes('roteirista')) return '✍️';
  if (r.includes('veredito') || r.includes('retenção') || r.includes('guardiã')) return '⚖️';
  if (r.includes('qualidade') || r.includes('qc') || r.includes('qa') || r.includes('test')) return '🔬';
  if (r.includes('direção') || r.includes('diretor') || r.includes('visual') || r.includes('director')) return '🎬';
  if (r.includes('edição') || r.includes('editor') || r.includes('montagem')) return '🎞️';
  if (r.includes('áudio') || r.includes('audio') || r.includes('narr')) return '🎙️';
  if (r.includes('dev') || r.includes('eng') || r.includes('código')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  if (r.includes('finance') || r.includes('financ')) return '💵';
  return '🤖';
}

export function SquadsPage() {
  const [equipes, setEquipes] = useState<Equipe[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Equipe | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [sq, ag] = await Promise.all([
      api.get<Equipe[]>('/squads').catch(() => []),
      api.get<Agent[]>('/enterprise/agents').catch(() => []),
    ]);
    setEquipes(sq || []);
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

  function openEdit(eq: Equipe) {
    setEditing(eq);
    setForm({
      name: eq.name, description: eq.description,
      mission: eq.mission, agentIds: eq.agentIds,
      leaderId: eq.leaderId || '', status: eq.status,
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
    if (!confirm(`Excluir equipe "${name}"?`)) return;
    await api.delete(`/squads/${id}`).catch(() => {});
    setEquipes(prev => prev.filter(s => s.id !== id));
  }

  async function toggleStatus(eq: Equipe) {
    const next = eq.status === 'active' ? 'paused' : 'active';
    await api.put(`/squads/${eq.id}`, { status: next }).catch(() => {});
    setEquipes(prev => prev.map(s => s.id === eq.id ? { ...s, status: next } : s));
  }

  function toggleAgent(id: string) {
    setForm(f => {
      const next = f.agentIds.includes(id)
        ? f.agentIds.filter(a => a !== id)
        : [...f.agentIds, id];
      // Se o líder foi removido, limpar leaderId
      const leaderId = next.includes(f.leaderId || '') ? f.leaderId : '';
      return { ...f, agentIds: next, leaderId };
    });
  }

  const agentById = Object.fromEntries(agents.map(a => [a.id, a]));

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-title">👥 Equipes</h1>
            <p className="page-subtitle">Gerencie times especializados de agentes com liderança e missão definidas.</p>
          </div>
          <button onClick={openCreate}>+ Criar Equipe</button>
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
          <strong style={{ color: 'var(--primary)' }}>Como funciona:</strong> Uma equipe é um grupo de agentes com missão e liderança definidas.
          O CEO pode criar equipes a partir do repositório <code>mw-creator</code> (ex: "Grandense" para vídeos de mistério).
          Pause uma equipe para que o CEO não atribua tarefas a nenhum membro dela.
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: 40 }}>Carregando...</div>
      ) : equipes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>Nenhuma equipe criada</h3>
          <p>Agrupe seus agentes em times especializados para projetos e missões específicas.</p>
          <button style={{ marginTop: 16 }} onClick={openCreate}>+ Criar primeira equipe</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {equipes.map(eq => {
            const info = STATUS_INFO[eq.status];
            const members = eq.agentIds.map(id => agentById[id]).filter(Boolean);
            const leader = eq.leaderId ? agentById[eq.leaderId] : null;
            return (
              <div key={eq.id} className="card" style={{
                padding: 0, overflow: 'hidden',
                borderLeft: `3px solid ${info.color}`,
                opacity: eq.status === 'paused' ? 0.75 : 1,
              }}>
                <div style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Nome + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{eq.name}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                          background: info.bg, color: info.color,
                          textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>
                          {info.label}
                        </span>
                        {eq.status === 'paused' && (
                          <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                            ⏸ CEO não atribui tarefas enquanto pausada
                          </span>
                        )}
                      </div>

                      {/* Líder */}
                      {leader && (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 12, color: '#f59e0b',
                          padding: '2px 8px', borderRadius: 20,
                          background: 'rgba(245,158,11,0.1)',
                          border: '1px solid rgba(245,158,11,0.25)',
                          marginBottom: 8,
                        }}>
                          <span>👑</span>
                          <span style={{ fontWeight: 600 }}>Líder: {leader.name}</span>
                        </div>
                      )}

                      {eq.description && (
                        <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 8 }}>
                          {eq.description}
                        </div>
                      )}

                      {eq.mission && (
                        <div style={{
                          fontSize: 12, color: 'var(--muted)',
                          padding: '6px 10px', background: 'var(--bg-2)',
                          borderRadius: 6, marginBottom: 10,
                          borderLeft: '2px solid var(--primary)',
                        }}>
                          <strong style={{ color: 'var(--fg-2)' }}>Missão:</strong> {eq.mission}
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
                            border: `1px solid ${a.id === eq.leaderId ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`,
                            borderRadius: 20, fontSize: 11,
                          }}>
                            {a.id === eq.leaderId && <span>👑</span>}
                            <span>{agentEmoji(a.role)}</span>
                            <span style={{ fontWeight: 600 }}>{a.name}</span>
                          </div>
                        ))}
                        {eq.agentIds.length > members.length && (
                          <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                            +{eq.agentIds.length - members.length} inativo{eq.agentIds.length - members.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        className="ghost"
                        style={{
                          fontSize: 11, padding: '5px 10px',
                          color: eq.status === 'active' ? 'var(--fg-2)' : '#10b981',
                        }}
                        onClick={() => toggleStatus(eq)}
                        title={eq.status === 'active' ? 'Pausar equipe' : 'Ativar equipe'}
                      >
                        {eq.status === 'active' ? '⏸ Pausar' : '▶ Ativar'}
                      </button>
                      <button
                        className="ghost"
                        style={{ fontSize: 11, padding: '5px 10px' }}
                        onClick={() => openEdit(eq)}
                      >
                        ✏️
                      </button>
                      <button
                        className="ghost"
                        style={{ fontSize: 11, padding: '5px 10px', color: 'var(--danger)' }}
                        onClick={() => remove(eq.id, eq.name)}
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
                  {leader && <span>👑 {leader.name} (líder)</span>}
                  <span>🕐 Criada {new Date(eq.createdAt).toLocaleDateString('pt-BR')}</span>
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
            <h2>{editing ? `✏️ Editar equipe — ${editing.name}` : '👥 Criar Equipe'}</h2>

            <div className="form-group">
              <label>Nome da Equipe *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Time de Lançamento, Equipe de Conteúdo..."
                autoFocus
              />
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="O que essa equipe faz?"
              />
            </div>

            <div className="form-group">
              <label>Missão atual</label>
              <textarea
                value={form.mission}
                onChange={e => setForm(f => ({ ...f, mission: e.target.value }))}
                placeholder="Ex: Produzir documentários de mistério de alta retenção para o canal Grandense..."
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
                    onClick={() => setForm(f => ({ ...f, status: key as Equipe['status'] }))}
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
              <label>Agentes da Equipe</label>
              {agents.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                  Nenhum agente ativo disponível.
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
                  {agents.map(a => {
                    const sel = form.agentIds.includes(a.id);
                    const isLeader = form.leaderId === a.id;
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
                        {isLeader && <span>👑</span>}
                        {agentEmoji(a.role)} {a.name}
                        {sel && !isLeader && <span style={{ fontWeight: 700 }}>✓</span>}
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

            {/* Seletor de líder */}
            {form.agentIds.length > 0 && (
              <div className="form-group">
                <label>👑 Líder da Equipe</label>
                <select
                  value={form.leaderId || ''}
                  onChange={e => setForm(f => ({ ...f, leaderId: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <option value="">— Sem líder definido —</option>
                  {form.agentIds.map(id => {
                    const a = agents.find(ag => ag.id === id);
                    return a ? (
                      <option key={id} value={id}>{agentEmoji(a.role)} {a.name} — {a.role}</option>
                    ) : null;
                  })}
                </select>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  O líder é o ponto de contato principal do CEO com esta equipe.
                </div>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowModal(false)}>Cancelar</button>
              <button onClick={save} disabled={saving || !form.name}>
                {saving ? 'Salvando...' : editing ? '💾 Salvar' : '👥 Criar Equipe'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
