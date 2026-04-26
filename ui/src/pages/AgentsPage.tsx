import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ModelPicker } from '../components/ModelPicker';
import { MODELO_PADRAO } from '@mwcode/shared';

interface Agent {
  id: string;
  name: string;
  role: string;
  adapter: string;
  model: string;
  skills: string[];
  status: string;
  performance: number;
  tasksCompleted: number;
  hiredAt: string;
}

interface HireForm {
  name: string;
  role: string;
  adapter: string;
  model: string;
  skills: string;
  instructions: string;
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
];

export function AgentsPage() {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHire, setShowHire] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'fired'>('active');
  const [form, setForm] = useState<HireForm>({
    name: '', role: '', adapter: 'openrouter', model: MODELO_PADRAO, skills: '', instructions: '',
  });
  const [hiring, setHiring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const list = await api.get<Agent[]>('/enterprise/agents');
      setAgents(list || []);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function hire() {
    if (!form.name || !form.role) { setError('Nome e função são obrigatórios.'); return; }
    setHiring(true);
    setError(null);
    try {
      await api.post('/enterprise/hire', {
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setShowHire(false);
      setForm({ name: '', role: '', adapter: 'openrouter', model: MODELO_PADRAO, skills: '', instructions: '' });
      await load();
    } catch (e: any) {
      setError(e.message || 'Erro ao contratar agente');
    } finally {
      setHiring(false);
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

  const filtered = agents.filter(a => filter === 'all' || a.status === filter);

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Agentes</h1>
            <p className="page-subtitle">Sua equipe de IA — crie, configure e converse com seus agentes.</p>
          </div>
          <button onClick={() => setShowHire(true)}>+ Contratar Agente</button>
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
            <button onClick={() => setShowHire(true)} style={{ marginTop: 16 }}>+ Contratar</button>
          )}
        </div>
      ) : (
        <div className="agents-grid">
          {filtered.map(agent => (
            <div key={agent.id} className={`agent-card${agent.status === 'fired' ? '' : ''}`}
              style={{ opacity: agent.status === 'fired' ? 0.55 : 1 }}>
              <div className="agent-header">
                <div className="agent-avatar">{agentEmoji(agent.role)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="agent-name">{agent.name}</div>
                  <div className="agent-role">{agent.role}</div>
                </div>
                <span className={`badge ${agent.status === 'active' ? 'badge-green' : 'badge-red'}`}>
                  {agent.status === 'active' ? 'Ativo' : 'Demitido'}
                </span>
              </div>

              <div className="agent-meta">
                <span className="badge badge-purple">{agent.adapter}</span>
                <span className="badge badge-gray">{agent.model?.split('/').pop()?.split(':')[0] ?? agent.model}</span>
                {agent.skills?.length > 0 && (
                  <span className="badge badge-yellow">🎯 {agent.skills.length} skill{agent.skills.length > 1 ? 's' : ''}</span>
                )}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, color: 'var(--muted)' }}>
                <span>📈 {agent.performance ?? 0}% perf</span>
                <span>✅ {agent.tasksCompleted ?? 0} tarefas</span>
              </div>

              {agent.status === 'active' && (
                <div className="agent-actions">
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
                    style={{ width: 34, height: 34 }}
                  >
                    🗑
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal de contratação */}
      {showHire && (
        <div className="modal-overlay" onClick={() => setShowHire(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 560 }}>
            <h2>Contratar Agente</h2>

            {/* Templates de função */}
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
                    onClick={() => setForm(f => ({ ...f, role: t.role, name: f.name || `Agente ${t.role}` }))}
                  >
                    {t.icon} {t.role}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" />

            <div className="form-group">
              <label>Nome do Agente *</label>
              <input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Maria — Assistente de Marketing"
              />
            </div>

            <div className="form-group">
              <label>Função *</label>
              <input
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="Ex: Copywriter, Desenvolvedor, Suporte..."
              />
            </div>

            <div className="form-group">
              <label>Instruções (system prompt)</label>
              <textarea
                value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                placeholder="Descreva o comportamento, personalidade e especialidades deste agente..."
                rows={4}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Provedor</label>
                <select value={form.adapter} onChange={e => setForm(f => ({ ...f, adapter: e.target.value }))}>
                  {ADAPTERS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="form-group">
                {form.adapter === 'openrouter' ? (
                  <ModelPicker
                    value={form.model}
                    onChange={model => setForm(f => ({ ...f, model }))}
                    mostrarPagos={false}
                    label="Modelo"
                  />
                ) : (
                  <>
                    <label>Modelo</label>
                    <input
                      value={form.model}
                      onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
                      placeholder="Ex: gpt-4o-mini"
                    />
                  </>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Skills (separadas por vírgula)</label>
              <input
                value={form.skills}
                onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
                placeholder="Ex: código, análise, redes sociais"
              />
            </div>

            {error && <div className="auth-error">{error}</div>}

            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowHire(false)}>Cancelar</button>
              <button onClick={hire} disabled={hiring || !form.name || !form.role}>
                {hiring ? 'Contratando...' : '✅ Contratar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
