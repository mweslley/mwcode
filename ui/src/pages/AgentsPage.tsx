import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ModelPicker } from '../components/ModelPicker';
import { MODELO_PADRAO } from '@mwcode/shared';

interface Agent {
  id: string;
  name: string;
  role: string;
  title?: string;
  adapter?: string;
  provider?: string;
  model: string;
  skills: string[];
  personality?: string;
  goals?: string[];
  status: string;
  performance?: number;
  tasksCompleted?: number;
  hireDate?: string;
  createdAt: string;
}

interface AgentForm {
  name: string;
  role: string;
  title: string;
  adapter: string;
  model: string;
  skills: string[];
  personality: string;
  goals: string;
  apiKey: string;
}

type KeyStatus = 'idle' | 'validating' | 'valid' | 'invalid';

interface Skill {
  id: string;
  name: string;
  description: string;
}

const ADAPTERS = ['openrouter', 'openai', 'gemini', 'ollama', 'deepseek', 'github'];

function agentEmoji(role: string) {
  const r = role?.toLowerCase() || '';
  if (r.includes('ceo') || r.includes('diretor')) return '👔';
  if (r.includes('dev') || r.includes('código') || r.includes('eng')) return '💻';
  if (r.includes('market') || r.includes('copy') || r.includes('social')) return '📣';
  if (r.includes('support') || r.includes('suporte') || r.includes('atend')) return '🎧';
  if (r.includes('design') || r.includes('ui') || r.includes('ux')) return '🎨';
  if (r.includes('data') || r.includes('analista') || r.includes('dados')) return '📊';
  if (r.includes('financ') || r.includes('conta')) return '💰';
  if (r.includes('qa') || r.includes('test')) return '🧪';
  return '🤖';
}

const ROLE_TEMPLATES = [
  { role: 'CEO', icon: '👔', desc: 'Visão geral e tomada de decisão' },
  { role: 'Desenvolvedor', icon: '💻', desc: 'Escreve e revisa código' },
  { role: 'Copywriter', icon: '✍️', desc: 'Cria conteúdo e textos' },
  { role: 'Analista de Dados', icon: '📊', desc: 'Analisa métricas e gera insights' },
  { role: 'Suporte ao Cliente', icon: '🎧', desc: 'Atende e resolve problemas' },
  { role: 'Estrategista de Marketing', icon: '📣', desc: 'Planeja campanhas e ações' },
  { role: 'Designer', icon: '🎨', desc: 'UX, visual e identidade da marca' },
  { role: 'Financeiro', icon: '💰', desc: 'Controle financeiro e relatórios' },
];

const emptyForm = (): AgentForm => ({
  name: '', role: '', title: '', adapter: 'openrouter', model: MODELO_PADRAO,
  skills: [], personality: '', goals: '', apiKey: '',
});

const PROVIDER_LABELS: Record<string, { label: string; placeholder: string; keyName: string }> = {
  openrouter: { label: 'OpenRouter', placeholder: 'sk-or-v1-...', keyName: 'openrouter' },
  openai: { label: 'OpenAI', placeholder: 'sk-...', keyName: 'openai' },
  gemini: { label: 'Google Gemini', placeholder: 'AIza...', keyName: 'gemini' },
  deepseek: { label: 'DeepSeek', placeholder: 'sk-...', keyName: 'deepseek' },
  github: { label: 'GitHub Models', placeholder: 'ghp_...', keyName: 'github' },
  ollama: { label: 'Ollama (local)', placeholder: 'http://localhost:11434', keyName: 'ollama_url' },
};

export function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHire, setShowHire] = useState(false);
  const [editAgent, setEditAgent] = useState<Agent | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'fired'>('active');
  const [triggeringCEO, setTriggeringCEO] = useState(false);
  const [form, setForm] = useState<AgentForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([]);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>('idle');
  const [keyInfo, setKeyInfo] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [list, skills] = await Promise.all([
        api.get<Agent[]>('/enterprise/agents'),
        api.get<Skill[]>('/skills').catch(() => []),
      ]);

      // Dedup: mantém só o primeiro agente por combinação nome+função
      const seen = new Set<string>();
      const deduped = (list || []).filter(a => {
        const key = `${a.name.trim().toLowerCase()}::${a.role.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setAgents(deduped);
      setAvailableSkills(skills || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function validateKey(provider: string, key: string) {
    if (!key.trim() || key.trim().length < 8) return;
    setKeyStatus('validating');
    setKeyInfo(null);
    try {
      // Save key first so server can validate it
      await api.put('/user/keys', { [PROVIDER_LABELS[provider]?.keyName || provider]: key.trim() });
      const r = await api.get<{ valid: boolean; error?: string; label?: string; credits?: number }>(
        `/models/validate?provider=${provider}`
      );
      if (r.valid) {
        setKeyStatus('valid');
        setKeyInfo(r.label ? `${r.label}${r.credits != null ? ` · $${Number(r.credits).toFixed(2)} créditos` : ''}` : 'Chave válida');
      } else {
        setKeyStatus('invalid');
        setKeyInfo(r.error || 'Chave inválida');
      }
    } catch {
      setKeyStatus('invalid');
      setKeyInfo('Erro ao validar');
    }
  }

  function openHire() {
    setForm(emptyForm());
    setEditAgent(null);
    setError(null);
    setKeyStatus('idle');
    setKeyInfo(null);
    setShowHire(true);
  }

  function openEdit(agent: Agent) {
    setEditAgent(agent);
    setForm({
      name: agent.name,
      role: agent.role,
      title: agent.title || '',
      adapter: agent.adapter || agent.provider || 'openrouter',
      model: agent.model || MODELO_PADRAO,
      skills: agent.skills || [],
      personality: agent.personality || '',
      goals: (agent.goals || []).join('\n'),
      apiKey: '',
    });
    setError(null);
    setKeyStatus('idle');
    setKeyInfo(null);
    setShowHire(true);
  }

  async function save() {
    if (!form.name || !form.role) { setError('Nome e função são obrigatórios.'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name,
      role: form.role,
      title: form.title || undefined,
      provider: form.adapter,
      model: form.model,
      skills: form.skills,
      personality: form.personality || undefined,
      goals: form.goals.split('\n').map(g => g.trim()).filter(Boolean),
    };
    try {
      if (editAgent) {
        await api.put(`/enterprise/agents/${editAgent.id}`, payload);
      } else {
        await api.post('/enterprise/agents/hire', payload);
      }
      setShowHire(false);
      setEditAgent(null);
      setForm(emptyForm());
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar agente');
    } finally {
      setSaving(false);
    }
  }

  async function fire(id: string, name: string) {
    if (!confirm(`Demitir ${name}? Isso encerrará todas as atividades do agente.`)) return;
    try {
      await api.delete(`/enterprise/agents/${id}`);
      await load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  }

  async function triggerCEO() {
    setTriggeringCEO(true);
    try {
      await api.post('/enterprise/company/bootstrap', {});
      setTimeout(() => { load(); setTriggeringCEO(false); }, 4000);
    } catch {
      setTriggeringCEO(false);
    }
  }

  async function reactivate(id: string) {
    try {
      await api.post(`/enterprise/agents/${id}/reactivate`, {});
      await load();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  }

  const filtered = agents.filter(a => filter === 'all' || a.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Agentes</h1>
            <p className="page-subtitle">Sua equipe de IA — crie, configure e converse com seus agentes.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ghost"
              onClick={triggerCEO}
              disabled={triggeringCEO}
              title="Aciona o CEO agora para criar tarefas e contratar agentes"
              style={{ fontSize: 12 }}
            >
              {triggeringCEO ? '⏳ Acionando...' : '⚡ Acionar CEO'}
            </button>
            <button onClick={openHire}>+ Contratar Agente</button>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {(['active', 'all', 'fired'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              background: filter === f ? 'var(--primary)' : 'var(--bg-2)',
              borderColor: filter === f ? 'var(--primary)' : 'var(--border)',
              color: filter === f ? '#fff' : 'var(--fg-2)',
            }}
          >
            {f === 'active' ? '✅ Ativos' : f === 'all' ? '🌐 Todos' : '❌ Demitidos'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', color: 'var(--muted)', fontSize: 12, alignSelf: 'center' }}>
          {filtered.length} agente{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid de agentes */}
      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🤖</div>
          <h3>Nenhum agente {filter === 'active' ? 'ativo' : filter === 'fired' ? 'demitido' : ''}</h3>
          <p>
            {filter === 'active'
              ? 'Contrate seu primeiro agente para começar.'
              : 'Nenhum agente encontrado com esse filtro.'}
          </p>
          {filter === 'active' && (
            <button onClick={openHire} style={{ marginTop: 16 }}>+ Contratar</button>
          )}
        </div>
      ) : (
        <div className="agents-grid">
          {filtered.map(agent => (
            <div key={agent.id} className="agent-card"
              style={{ opacity: agent.status === 'fired' ? 0.6 : 1 }}>
              <div className="agent-header">
                <div className="agent-avatar">{agentEmoji(agent.role)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-role">{agent.title || agent.role}</div>
                </div>
                <span className={`badge ${agent.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                  {agent.status === 'active' ? 'Ativo' : 'Demitido'}
                </span>
              </div>

              <div className="agent-meta">
                <span className="badge badge-purple">{agent.adapter || agent.provider}</span>
                <span className="badge badge-gray">{agent.model?.split('/').pop()?.split(':')[0] ?? agent.model}</span>
                {agent.skills?.length > 0 && (
                  <span className="badge badge-yellow">🎯 {agent.skills.length} skill{agent.skills.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {agent.personality && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.5,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                  {agent.personality.slice(0, 140)}{agent.personality.length > 140 ? '…' : ''}
                </div>
              )}

              {agent.goals && agent.goals.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.4 }}>
                  🎯 {agent.goals.slice(0, 2).join(' · ')}{agent.goals.length > 2 ? ` +${agent.goals.length - 2}` : ''}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12, fontSize: 11, color: 'var(--muted)' }}>
                <span>📈 {agent.performance ?? 0}% perf</span>
                <span>✅ {agent.tasksCompleted ?? 0} tarefas</span>
              </div>

              <div className="agent-actions">
                {agent.status === 'active' ? (
                  <>
                    <button
                      className="ghost"
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px' }}
                      onClick={() => openEdit(agent)}
                    >
                      ✏️ Editar
                    </button>
                    <button
                      style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px' }}
                      onClick={() => navigate(`/chat/${agent.id}`)}
                    >
                      💬 Conversar
                    </button>
                    <button
                      className="danger icon-btn"
                      title="Demitir agente"
                      onClick={() => fire(agent.id, agent.name)}
                      style={{ width: 34, height: 34, padding: 0, justifyContent: 'center', flexShrink: 0 }}
                    >
                      🗑
                    </button>
                  </>
                ) : (
                  <button
                    className="ghost"
                    style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
                    onClick={() => reactivate(agent.id)}
                  >
                    ♻️ Reativar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de contratação / edição */}
      {showHire && (
        <div className="modal-overlay" onClick={() => setShowHire(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 580, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>{editAgent ? `✏️ Editar — ${editAgent.name}` : 'Contratar Agente'}</h2>

            {/* Templates (só ao criar) */}
            {!editAgent && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 8 }}>
                  Começar de um template
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {ROLE_TEMPLATES.map(t => (
                    <button
                      key={t.role}
                      className="ghost"
                      style={{ fontSize: 12, padding: '5px 10px' }}
                      onClick={() => setForm(f => ({
                        ...f,
                        role: t.role,
                        name: f.name || `Agente ${t.role}`,
                        title: t.desc,
                      }))}
                    >
                      {t.icon} {t.role}
                    </button>
                  ))}
                </div>
                <div className="divider" style={{ margin: '16px 0' }} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Nome do Agente *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Maria — Marketing"
                />
              </div>
              <div className="form-group">
                <label>Função *</label>
                <input
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  placeholder="Ex: Copywriter, CEO, Desenvolvedor..."
                />
              </div>
            </div>

            <div className="form-group">
              <label>Título (opcional)</label>
              <input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Head de Marketing Digital"
              />
            </div>

            <div className="form-group">
              <label>Personalidade / Instruções (system prompt)</label>
              <textarea
                value={form.personality}
                onChange={e => setForm(f => ({ ...f, personality: e.target.value }))}
                placeholder="Descreva o comportamento, tom e especialidades deste agente. Quanto mais detalhado, melhor..."
                rows={5}
              />
            </div>

            <div className="form-group">
              <label>Objetivos (um por linha)</label>
              <textarea
                value={form.goals}
                onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                placeholder="Ex: Aumentar alcance nas redes sociais&#10;Criar 3 posts por semana&#10;Monitorar concorrentes"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Provedor de IA</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {Object.entries(PROVIDER_LABELS).map(([key, info]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setForm(f => ({ ...f, adapter: key, apiKey: '', model: key === 'openrouter' ? MODELO_PADRAO : f.model }));
                      setKeyStatus('idle');
                      setKeyInfo(null);
                    }}
                    style={{
                      fontSize: 12, padding: '5px 12px',
                      background: form.adapter === key ? 'var(--primary)' : 'var(--bg-2)',
                      color: form.adapter === key ? '#fff' : 'var(--fg-2)',
                      borderColor: form.adapter === key ? 'var(--primary)' : 'var(--border)',
                    }}
                  >
                    {info.label}
                  </button>
                ))}
              </div>

              {/* API key input for non-openrouter providers or when user wants to update */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="password"
                  value={form.apiKey}
                  onChange={e => { setForm(f => ({ ...f, apiKey: e.target.value })); setKeyStatus('idle'); }}
                  onBlur={() => { if (form.apiKey.trim().length > 8) validateKey(form.adapter, form.apiKey); }}
                  placeholder={`Chave ${PROVIDER_LABELS[form.adapter]?.label || form.adapter} (${PROVIDER_LABELS[form.adapter]?.placeholder || 'API key'})`}
                  style={{ flex: 1, fontSize: 12, borderColor: keyStatus === 'valid' ? 'var(--success)' : keyStatus === 'invalid' ? 'var(--danger)' : 'var(--border)' }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => validateKey(form.adapter, form.apiKey)}
                  disabled={!form.apiKey || keyStatus === 'validating'}
                  style={{ fontSize: 12, padding: '7px 12px', whiteSpace: 'nowrap' }}
                >
                  {keyStatus === 'validating' ? '...' : 'Verificar'}
                </button>
              </div>
              {keyStatus === 'valid' && <small style={{ color: 'var(--success)', fontSize: 11 }}>✅ {keyInfo}</small>}
              {keyStatus === 'invalid' && <small style={{ color: 'var(--danger)', fontSize: 11 }}>❌ {keyInfo}</small>}
              {form.adapter !== 'openrouter' && !form.apiKey && (
                <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                  Insira sua chave de API para {PROVIDER_LABELS[form.adapter]?.label}. A chave será salva nas suas configurações.
                </small>
              )}
            </div>

            <div className="form-group">
              {form.adapter === 'openrouter' ? (
                <ModelPicker
                  value={form.model}
                  onChange={model => setForm(f => ({ ...f, model }))}
                  mostrarPagos={true}
                  label="Modelo"
                  provider="openrouter"
                />
              ) : (
                <>
                  <label>Modelo</label>
                  <input
                    value={form.model}
                    onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                    placeholder={
                      form.adapter === 'openai' ? 'Ex: gpt-4o-mini' :
                      form.adapter === 'gemini' ? 'Ex: gemini-1.5-flash' :
                      form.adapter === 'deepseek' ? 'Ex: deepseek-chat' :
                      form.adapter === 'ollama' ? 'Ex: llama3' : 'ID do modelo'
                    }
                  />
                </>
              )}
            </div>

            <div className="form-group">
              <label>Skills — selecione da biblioteca</label>
              {availableSkills.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--muted)', padding: '8px 0' }}>
                  Nenhuma skill criada ainda.{' '}
                  <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => window.open('/skills', '_self')}>
                    Criar skills →
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 4 }}>
                  {availableSkills.map(s => {
                    const selected = form.skills.includes(s.name);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        title={s.description}
                        onClick={() => setForm(f => ({
                          ...f,
                          skills: selected
                            ? f.skills.filter(sk => sk !== s.name)
                            : [...f.skills, s.name],
                        }))}
                        style={{
                          padding: '5px 12px',
                          fontSize: 12,
                          borderRadius: 20,
                          border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`,
                          background: selected ? 'rgba(146,48,249,0.15)' : 'var(--bg-2)',
                          color: selected ? 'var(--primary)' : 'var(--fg-2)',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                      >
                        {selected ? '✓ ' : ''}{s.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.skills.length > 0 && (
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                  Selecionadas: {form.skills.join(', ')}
                </div>
              )}
            </div>

            {error && <div className="auth-error">{error}</div>}

            <div className="modal-actions">
              <button className="ghost" onClick={() => { setShowHire(false); setEditAgent(null); }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving || !form.name || !form.role}>
                {saving
                  ? (editAgent ? 'Salvando...' : 'Contratando...')
                  : (editAgent ? '💾 Salvar alterações' : '✅ Contratar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
