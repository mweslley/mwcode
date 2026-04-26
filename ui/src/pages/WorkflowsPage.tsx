import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface WorkflowStep {
  type: 'trigger' | 'agent' | 'action';
  label: string;
  config?: Record<string, string>;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  steps: WorkflowStep[];
  runs: number;
  lastRun?: string;
  createdAt: string;
}

interface WFForm {
  name: string;
  description: string;
  triggerType: string;
  triggerConfig: string;
  agentIds: string;
  actionType: string;
  actionConfig: string;
}

// ── Cron picker ─────────────────────────────────────────────────────────────

interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
}

const WEEKDAYS = [
  { v: '1', l: 'Seg' }, { v: '2', l: 'Ter' }, { v: '3', l: 'Qua' },
  { v: '4', l: 'Qui' }, { v: '5', l: 'Sex' }, { v: '6', l: 'Sáb' }, { v: '0', l: 'Dom' },
];

const BRT_PRESETS = [
  { label: 'Todo dia às 9h (Brasília)', cron: '0 12 * * *' },
  { label: 'Todo dia às 18h (Brasília)', cron: '0 21 * * *' },
  { label: 'Seg, Qua, Sex às 10h', cron: '0 13 * * 1,3,5' },
  { label: 'Segunda às 8h', cron: '0 11 * * 1' },
  { label: 'Toda sexta às 17h', cron: '0 20 * * 5' },
  { label: 'Toda hora', cron: '0 * * * *' },
  { label: '1º de cada mês às 9h', cron: '0 12 1 * *' },
];

function buildCron(hour: string, min: string, days: string[]): string {
  // BRT = UTC-3, then convert: UTC_hour = BRT_hour + 3
  const utcHour = ((parseInt(hour) + 3) % 24).toString();
  if (days.length === 0 || days.length === 7) {
    return `${min} ${utcHour} * * *`;
  }
  return `${min} ${utcHour} * * ${days.join(',')}`;
}

function parseCronToBRT(cron: string): { hour: string; min: string; days: string[] } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [min, utcH, , , dayStr] = parts;
  const utcHour = parseInt(utcH);
  if (isNaN(utcHour)) return null;
  const brtHour = ((utcHour - 3 + 24) % 24).toString().padStart(2, '0');
  const days = dayStr === '*' ? [] : dayStr.split(',');
  return { hour: brtHour, min: min.padStart(2, '0'), days };
}

function CronPicker({ value, onChange }: CronPickerProps) {
  const parsed = value ? parseCronToBRT(value) : null;
  const [hour, setHour] = useState(parsed?.hour ?? '09');
  const [min, setMin] = useState(parsed?.min ?? '00');
  const [days, setDays] = useState<string[]>(parsed?.days ?? []);
  const [mode, setMode] = useState<'visual' | 'raw'>('visual');

  function toggleDay(d: string) {
    setDays(prev => {
      const next = prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d];
      onChange(buildCron(hour, min, next));
      return next;
    });
  }

  function onHourChange(h: string) {
    setHour(h);
    onChange(buildCron(h, min, days));
  }

  function onMinChange(m: string) {
    setMin(m);
    onChange(buildCron(hour, m, days));
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button
          className={mode === 'visual' ? '' : 'ghost'}
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => setMode('visual')}
        >🕐 Visual</button>
        <button
          className={mode === 'raw' ? '' : 'ghost'}
          style={{ fontSize: 11, padding: '4px 10px' }}
          onClick={() => setMode('raw')}
        >⌨️ Cron direto</button>
      </div>

      {mode === 'visual' ? (
        <>
          {/* Presets BRT */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>
              Horários recomendados (Brasília / BRT)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {BRT_PRESETS.map(p => (
                <button
                  key={p.cron}
                  className="ghost"
                  style={{ fontSize: 11, padding: '3px 9px' }}
                  onClick={() => {
                    const parsed2 = parseCronToBRT(p.cron);
                    if (parsed2) {
                      setHour(parsed2.hour);
                      setMin(parsed2.min);
                      setDays(parsed2.days);
                    }
                    onChange(p.cron);
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horário */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', minWidth: 70 }}>Horário (BRT)</div>
            <select
              value={hour}
              onChange={e => onHourChange(e.target.value)}
              style={{ width: 72, fontSize: 13 }}
            >
              {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map(h => (
                <option key={h} value={h}>{h}h</option>
              ))}
            </select>
            <span style={{ color: 'var(--muted)' }}>:</span>
            <select
              value={min}
              onChange={e => onMinChange(e.target.value)}
              style={{ width: 72, fontSize: 13 }}
            >
              {['00', '15', '30', '45'].map(m => (
                <option key={m} value={m}>{m}min</option>
              ))}
            </select>
          </div>

          {/* Dias da semana */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}>
              Dias (vazio = todo dia)
            </div>
            <div style={{ display: 'flex', gap: 5 }}>
              {WEEKDAYS.map(d => (
                <button
                  key={d.v}
                  onClick={() => toggleDay(d.v)}
                  style={{
                    width: 38, height: 34, fontSize: 12, padding: 0,
                    background: days.includes(d.v) ? 'var(--primary)' : 'var(--bg-2)',
                    borderColor: days.includes(d.v) ? 'var(--primary)' : 'var(--border)',
                    color: days.includes(d.v) ? '#fff' : 'var(--fg-2)',
                  }}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>

          {/* Resultado */}
          <div style={{
            padding: '8px 12px',
            background: 'var(--bg-2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Cron (UTC):</span>
            <code style={{ fontSize: 12, color: 'var(--primary)' }}>{value || buildCron(hour, min, days)}</code>
          </div>
        </>
      ) : (
        <div>
          <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
            Expressão cron (UTC) — ex: <code>0 12 * * 1-5</code>
          </label>
          <input
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="min hora dia mês diasemana"
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
          />
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--muted)' }}>
            ⚠️ Atenção: insira em UTC. Brasília = UTC-3 (some 3h ao horário BRT).
          </div>
        </div>
      )}
    </div>
  );
}

// ── Componentes de ação ──────────────────────────────────────────────────────

const TRIGGERS = [
  { value: 'webhook', label: '🌐 Webhook', desc: 'Dispara ao receber uma chamada HTTP externa' },
  { value: 'schedule', label: '🕐 Agendamento', desc: 'Executa automaticamente num horário definido' },
  { value: 'manual', label: '▶️ Manual', desc: 'Você clica no botão "Executar" quando quiser' },
  { value: 'event', label: '⚡ Evento', desc: 'Dispara quando uma mensagem ou evento chega' },
];

const ACTIONS = [
  { value: 'message', label: '💬 Salvar resposta', desc: 'Guarda a resposta do agente no histórico' },
  { value: 'discord', label: '🎮 Postar no Discord', desc: 'Envia resultado para um canal via Webhook' },
  { value: 'webhook', label: '🌐 Chamar Webhook', desc: 'Faz POST com o resultado para uma URL' },
  { value: 'email', label: '📧 Enviar e-mail', desc: 'Envia o resultado por e-mail (requer SMTP)' },
];

const EXAMPLES = [
  {
    name: 'Relatório Diário',
    description: 'Gera e envia um relatório de atividades todo dia às 9h',
    steps: [
      { type: 'trigger' as const, label: '🕐 Diariamente às 9h' },
      { type: 'agent' as const, label: '📊 Analista de Dados' },
      { type: 'action' as const, label: '💬 Enviar relatório' },
    ],
  },
  {
    name: 'Suporte Automático',
    description: 'Responde mensagens de clientes automaticamente via webhook',
    steps: [
      { type: 'trigger' as const, label: '⚡ Nova mensagem' },
      { type: 'agent' as const, label: '🎧 Agente de Suporte' },
      { type: 'action' as const, label: '💬 Responder cliente' },
    ],
  },
  {
    name: 'Post Semanal',
    description: 'Cria conteúdo para redes sociais toda segunda às 10h',
    steps: [
      { type: 'trigger' as const, label: '🕐 Segunda, 10h' },
      { type: 'agent' as const, label: '📣 Copywriter' },
      { type: 'action' as const, label: '📸 Postar' },
    ],
  },
];

function stepColor(type: WorkflowStep['type']) {
  if (type === 'trigger') return 'trigger';
  if (type === 'agent') return 'agent-node';
  return 'action';
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<WFForm>({
    name: '', description: '', triggerType: 'manual',
    triggerConfig: '', agentIds: '', actionType: 'message', actionConfig: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<Workflow[]>('/workflows')
      .then(list => setWorkflows(list || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form.name) { setError('Nome é obrigatório'); return; }
    setSaving(true);
    setError(null);
    try {
      await api.post('/workflows', form);
      const list = await api.get<Workflow[]>('/workflows');
      setWorkflows(list || []);
      setShowCreate(false);
      setForm({ name: '', description: '', triggerType: 'manual', triggerConfig: '', agentIds: '', actionType: 'message', actionConfig: '' });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(id: string, enabled: boolean) {
    await api.put(`/workflows/${id}`, { enabled: !enabled }).catch(() => {});
    setWorkflows(wfs => wfs.map(w => w.id === id ? { ...w, enabled: !enabled } : w));
  }

  async function run(id: string) {
    try {
      await api.post(`/workflows/${id}/run`, {});
      alert('Workflow executado!');
    } catch (e: any) {
      alert('Erro ao executar: ' + e.message);
    }
  }

  async function remove(id: string) {
    if (!confirm('Deletar este workflow?')) return;
    await api.delete(`/workflows/${id}`).catch(() => {});
    setWorkflows(wfs => wfs.filter(w => w.id !== id));
  }

  const selectedTrigger = TRIGGERS.find(t => t.value === form.triggerType);
  const selectedAction = ACTIONS.find(a => a.value === form.actionType);

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">Workflows</h1>
            <p className="page-subtitle">Automatize tarefas encadeando agentes, triggers e ações.</p>
          </div>
          <button onClick={() => setShowCreate(true)}>+ Criar Workflow</button>
        </div>
      </div>

      {/* Templates de exemplo */}
      {workflows.length === 0 && !loading && (
        <>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Templates de exemplo</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)' }}>Clique para criar a partir de um template:</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {EXAMPLES.map((ex, i) => (
              <div key={i} className="workflow-card"
                onClick={() => {
                  setForm(f => ({ ...f, name: ex.name, description: ex.description }));
                  setShowCreate(true);
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className="workflow-icon">⚡</div>
                <div className="workflow-info">
                  <div className="workflow-name">{ex.name}</div>
                  <div className="workflow-desc">{ex.description}</div>
                  <div className="pipeline" style={{ marginTop: 8, marginBottom: 0 }}>
                    {ex.steps.map((s, j) => (
                      <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className={`pipeline-node ${stepColor(s.type)}`}>{s.label}</div>
                        {j < ex.steps.length - 1 && <span className="pipeline-arrow">→</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <button style={{ fontSize: 11, padding: '4px 10px' }}>Usar template</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Workflows do usuário */}
      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>Carregando...</div>
      ) : workflows.length > 0 && (
        <>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Meus workflows</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {workflows.map(wf => (
              <div key={wf.id} className="workflow-card">
                <div className="workflow-icon">{wf.enabled ? '⚡' : '⏸'}</div>
                <div className="workflow-info">
                  <div className="workflow-name">{wf.name}</div>
                  <div className="workflow-desc">{wf.description || 'Sem descrição'}</div>
                  {wf.lastRun && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Última execução: {new Date(wf.lastRun).toLocaleString('pt-BR')}
                    </div>
                  )}
                </div>
                <div className="workflow-meta">
                  <span className={`badge ${wf.enabled ? 'badge-green' : 'badge-gray'}`}>
                    {wf.enabled ? 'Ativo' : 'Pausado'}
                  </span>
                  <span className="badge badge-gray">{wf.runs ?? 0} runs</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="ghost"
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => toggleEnabled(wf.id, wf.enabled)}
                    >
                      {wf.enabled ? 'Pausar' : 'Ativar'}
                    </button>
                    <button
                      style={{ fontSize: 11, padding: '4px 10px' }}
                      onClick={() => run(wf.id)}
                    >
                      ▶ Executar
                    </button>
                    <button
                      className="ghost"
                      style={{ fontSize: 11, padding: '4px 8px', color: 'var(--danger)' }}
                      onClick={() => remove(wf.id)}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modal de criação */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>Criar Workflow</h2>

            <div className="form-group">
              <label>Nome *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ex: Relatório Semanal" />
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="O que este workflow faz?" />
            </div>

            {/* ── TRIGGER ── */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                ① Gatilho (quando começa)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
                {TRIGGERS.map(t => (
                  <div
                    key={t.value}
                    onClick={() => setForm(f => ({ ...f, triggerType: t.value, triggerConfig: '' }))}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${form.triggerType === t.value ? 'var(--primary)' : 'var(--border)'}`,
                      background: form.triggerType === t.value ? 'rgba(146,48,249,0.1)' : 'var(--bg-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{t.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t.desc}</div>
                  </div>
                ))}
              </div>

              {form.triggerType === 'schedule' && (
                <div>
                  <label style={{ fontSize: 12, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>
                    🕐 Configurar agendamento (Brasília / BRT)
                  </label>
                  <CronPicker
                    value={form.triggerConfig}
                    onChange={v => setForm(f => ({ ...f, triggerConfig: v }))}
                  />
                </div>
              )}

              {form.triggerType === 'webhook' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Caminho do webhook (ex: /meu-workflow)</label>
                  <input
                    value={form.triggerConfig}
                    onChange={e => setForm(f => ({ ...f, triggerConfig: e.target.value }))}
                    placeholder="/meu-workflow"
                  />
                </div>
              )}
            </div>

            {/* ── AGENTES ── */}
            <div className="form-group">
              <label style={{ fontWeight: 600 }}>② Agentes (IDs separados por vírgula)</label>
              <input
                value={form.agentIds}
                onChange={e => setForm(f => ({ ...f, agentIds: e.target.value }))}
                placeholder="IDs dos agentes — deixe vazio para usar o assistente geral"
              />
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                Encontre os IDs na página de Agentes. Vazio = assistente geral sem personalidade específica.
              </small>
            </div>

            {/* ── AÇÃO ── */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8 }}>
                ③ Ação final (o que fazer com o resultado)
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
                {ACTIONS.map(a => (
                  <div
                    key={a.value}
                    onClick={() => setForm(f => ({ ...f, actionType: a.value, actionConfig: '' }))}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${form.actionType === a.value ? 'var(--secondary)' : 'var(--border)'}`,
                      background: form.actionType === a.value ? 'rgba(0,188,138,0.1)' : 'var(--bg-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{a.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{a.desc}</div>
                  </div>
                ))}
              </div>

              {(form.actionType === 'discord' || form.actionType === 'webhook') && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>{form.actionType === 'discord' ? 'Webhook URL do Discord' : 'URL do webhook'}</label>
                  <input
                    value={form.actionConfig}
                    onChange={e => setForm(f => ({ ...f, actionConfig: e.target.value }))}
                    placeholder="https://..."
                  />
                </div>
              )}

              {form.actionType === 'email' && (
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Destinatário (e-mail)</label>
                  <input
                    value={form.actionConfig}
                    onChange={e => setForm(f => ({ ...f, actionConfig: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
              )}
            </div>

            {/* Preview do pipeline */}
            {form.name && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 8 }}>
                  Preview do pipeline
                </label>
                <div className="pipeline">
                  <div className="pipeline-node trigger">
                    {selectedTrigger?.label || 'Trigger'}
                  </div>
                  <span className="pipeline-arrow">→</span>
                  <div className="pipeline-node agent-node">
                    {form.agentIds ? '🤖 Agentes personalizados' : '✨ Assistente Geral'}
                  </div>
                  <span className="pipeline-arrow">→</span>
                  <div className="pipeline-node action">
                    {selectedAction?.label || 'Ação'}
                  </div>
                </div>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <div className="modal-actions">
              <button className="ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button onClick={save} disabled={saving || !form.name}>
                {saving ? 'Salvando...' : '⚡ Criar Workflow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
