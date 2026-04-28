import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ModelPicker } from '../components/ModelPicker';
import { MODELO_PADRAO } from '@mwcode/shared';

type KeyStatus = 'idle' | 'validating' | 'valid' | 'invalid';

const TOTAL_STEPS = 4;

const PROVIDER_OPTIONS = [
  { key: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-v1-...', hint: 'Acesso a dezenas de modelos (recomendado). Crie sua chave gratuita em openrouter.ai' },
  { key: 'openai', label: 'OpenAI', placeholder: 'sk-...', hint: 'GPT-4o, GPT-4o-mini e outros modelos OpenAI.' },
  { key: 'gemini', label: 'Google Gemini', placeholder: 'AIza...', hint: 'Gemini 1.5 Flash, Pro e outros modelos Google.' },
  { key: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...', hint: 'Modelos DeepSeek — excelente custo-benefício.' },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [apiKeySaving, setApiKeySaving] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [data, setData] = useState({
    companyName: '',
    area: '',
    mission: '',
    employees: '1-10',
    goals: [] as string[],
    ceoModel: MODELO_PADRAO,
  });
  const [goalInput, setGoalInput] = useState('');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({
    openrouter: '',
    openai: '',
    gemini: '',
    deepseek: '',
  });
  const [keyStatuses, setKeyStatuses] = useState<Record<string, KeyStatus>>({});

  function addGoal() {
    if (goalInput.trim()) {
      setData(d => ({ ...d, goals: [...d.goals, goalInput.trim()] }));
      setGoalInput('');
    }
  }

  const hasAtLeastOneKey = Object.values(apiKeys).some(v => v.trim().length > 10);

  async function validateKey(provider: string, key: string) {
    if (!key.trim() || key.trim().length < 10) return;
    setKeyStatuses(s => ({ ...s, [provider]: 'validating' }));
    try {
      // save key first so the server can use it for validation
      await api.put('/user/keys', { [provider]: key.trim() });
      const result = await api.get<{ valid: boolean; error?: string }>(`/models/validate?provider=${provider}`);
      setKeyStatuses(s => ({ ...s, [provider]: result.valid ? 'valid' : 'invalid' }));
    } catch {
      setKeyStatuses(s => ({ ...s, [provider]: 'invalid' }));
    }
  }

  async function saveApiKeys() {
    setApiKeySaving(true);
    setApiKeyError(null);
    try {
      const toValidate = Object.entries(apiKeys).filter(([, v]) => v.trim().length > 10);
      // validate keys not yet confirmed valid
      for (const [provider, key] of toValidate) {
        if (keyStatuses[provider] !== 'valid') {
          await validateKey(provider, key);
        }
      }
      // read updated statuses from state is async — check directly from API results
      const results = await Promise.all(
        toValidate.map(([provider]) =>
          api.get<{ valid: boolean }>(`/models/validate?provider=${provider}`).catch(() => ({ valid: false }))
        )
      );
      const anyValid = results.some(r => r.valid);
      if (!anyValid && toValidate.length > 0) {
        setApiKeyError('Nenhuma chave válida. Verifique e tente novamente.');
        return;
      }
      setStep(4);
    } catch (e: any) {
      setApiKeyError(e.message || 'Erro ao salvar chaves');
    } finally {
      setApiKeySaving(false);
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const company = await api.post<any>('/enterprise/company', data);

      // Check if CEO already exists to prevent duplicates
      const existingAgents = await api.get<any[]>('/enterprise/agents').catch(() => []);
      const existingCeo = (existingAgents || []).find((a: any) =>
        a.role === 'ceo' || (a.name || '').toLowerCase() === 'ceo'
      );
      const isNewCeo = !existingCeo;
      const ceo = existingCeo || await api.post<any>('/enterprise/agents/hire', {
        name: 'CEO',
        role: 'ceo',
        title: 'CEO — Chief Executive Officer',
        personality:
          `Você é o CEO da ${data.companyName}, responsável por orquestrar e administrar a empresa. ` +
          `Atua na área de ${data.area || 'negócios'}. ` +
          `Sua missão: ${data.mission || 'fazer a empresa crescer com agentes de IA'}. ` +
          `Você toma decisões estratégicas, contrata e gerencia outros agentes de IA para compor sua equipe, ` +
          `delega tarefas, monitora o desempenho da equipe e reporta resultados ao usuário. ` +
          `Quando precisar tomar uma decisão importante que envolva gastos, ações irreversíveis ou impacto no negócio, ` +
          `sempre inclua [APROVAÇÃO NECESSÁRIA] na sua mensagem e aguarde a aprovação do usuário antes de prosseguir. ` +
          `Ao ser iniciado pela primeira vez, analise os objetivos da empresa e elabore um plano de ação ` +
          `com os primeiros agentes a contratar e as primeiras tarefas a executar. ` +
          `Sempre responda em português brasileiro de forma direta e profissional.`,
        goals: data.goals,
        provider: 'openrouter',
        model: data.ceoModel,
      });

      // Boot do CEO (apenas quando é novo)
      if (ceo?.id && isNewCeo) {
        const bootMsg =
          `Você acabou de ser contratado como CEO da ${data.companyName}. ` +
          (data.mission ? `Nossa missão é: ${data.mission}. ` : '') +
          (data.goals.length > 0 ? `Nossos objetivos: ${data.goals.join(', ')}. ` : '') +
          `Analise e me apresente: ` +
          `1) Quais agentes contratar primeiro e por quê. ` +
          `2) As 3 primeiras ações que vai tomar como CEO. ` +
          `3) Como vai medir o sucesso nas próximas semanas. ` +
          `Para ações que precisem de aprovação, use [APROVAÇÃO NECESSÁRIA]. Seja direto e prático.`;

        await api.post(`/chat/${ceo.id}`, { message: bootMsg }).catch(() => {});

        // Cria workflow semanal do CEO automaticamente
        const mainGoal = data.goals[0] || data.mission || 'acompanhar progresso da empresa';
        await api.post('/workflows', {
          name: `Relatório Semanal — CEO`,
          description: `CEO apresenta relatório semanal de progresso: ${mainGoal}`,
          triggerType: 'schedule',
          triggerConfig: '0 12 * * 1', // toda segunda às 9h BRT (12h UTC)
          agentIds: ceo.id,
          actionType: 'message',
          actionConfig: '',
          enabled: true,
        }).catch(() => {});
      }

      localStorage.setItem('company', JSON.stringify(company || data));
      localStorage.removeItem('mode');
      navigate('/dashboard');
    } catch (err: any) {
      alert('Erro ao configurar workspace: ' + (err?.message || 'tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  // Verifica se tem backup (usuário veio de "Reconfigurar workspace")
  const hasBackup = !!localStorage.getItem('company_backup');

  return (
    <div className="onboarding-page">
      <div className="onboarding-box">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            {hasBackup ? 'Reconfigurar Workspace' : 'Bem-vindo ao MWCode'}
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Configure seu workspace em {TOTAL_STEPS} passos rápidos
          </p>
          {hasBackup && (
            <button
              className="ghost"
              style={{ fontSize: 12, marginTop: 10, color: 'var(--muted)' }}
              onClick={() => {
                const backup = localStorage.getItem('company_backup');
                if (backup) {
                  localStorage.setItem('company', backup);
                  localStorage.removeItem('company_backup');
                }
                navigate('/dashboard');
              }}
            >
              ← Cancelar e restaurar configuração anterior
            </button>
          )}
        </div>

        {/* Progress */}
        <div className="onboarding-progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`progress-step${i + 1 < step ? ' done' : i + 1 === step ? ' active' : ''}`}
            />
          ))}
        </div>

        <div className="card">
          {/* ── Step 1: Empresa ── */}
          {step === 1 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Sua empresa</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                Nos conte o básico sobre o seu negócio.
              </p>

              <div className="form-group">
                <label>Nome da empresa *</label>
                <input
                  value={data.companyName}
                  onChange={e => setData(d => ({ ...d, companyName: e.target.value }))}
                  placeholder="Ex: Loja MWO, Minha Startup..."
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Área de atuação</label>
                <input
                  value={data.area}
                  onChange={e => setData(d => ({ ...d, area: e.target.value }))}
                  placeholder="Ex: Hosting, E-commerce, SaaS, Marketing..."
                />
              </div>
              <div className="form-group">
                <label>Tamanho da equipe</label>
                <select value={data.employees} onChange={e => setData(d => ({ ...d, employees: e.target.value }))}>
                  <option value="1-10">1–10 pessoas</option>
                  <option value="11-50">11–50 pessoas</option>
                  <option value="51-200">51–200 pessoas</option>
                  <option value="200+">200+ pessoas</option>
                </select>
              </div>

              <button
                style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                onClick={() => setStep(2)}
                disabled={!data.companyName}
              >
                Próximo →
              </button>
            </>
          )}

          {/* ── Step 2: Missão e metas ── */}
          {step === 2 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Missão e objetivos</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                Isso guia o comportamento dos seus agentes.
              </p>

              <div className="form-group">
                <label>Missão da empresa</label>
                <textarea
                  value={data.mission}
                  onChange={e => setData(d => ({ ...d, mission: e.target.value }))}
                  placeholder="Ex: Oferecer VPS acessíveis para gamers brasileiros..."
                  rows={3}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Metas principais</label>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGoal())}
                    placeholder="Ex: Aumentar clientes em 30%..."
                    style={{ flex: 1 }}
                  />
                  <button onClick={addGoal} style={{ padding: '8px 14px' }}>+</button>
                </div>
                {data.goals.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {data.goals.map((g, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '7px 10px', background: 'var(--bg-3)',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', fontSize: 13,
                      }}>
                        <span style={{ flex: 1 }}>✅ {g}</span>
                        <button
                          className="ghost"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => setData(d => ({ ...d, goals: d.goals.filter((_, j) => j !== i) }))}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="ghost" onClick={() => setStep(1)} style={{ flex: 1, justifyContent: 'center' }}>
                  ← Voltar
                </button>
                <button onClick={() => setStep(3)} style={{ flex: 2, justifyContent: 'center' }}>
                  Próximo →
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Chaves de API ── */}
          {step === 3 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>🔑 Sua chave de API</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 4 }}>
                O MWCode usa sua própria chave de API para funcionar. Cada usuário usa sua própria conta — seus dados ficam separados.
              </p>

              {/* Destaque OpenRouter */}
              <div style={{
                padding: '12px 14px', marginBottom: 20,
                background: 'rgba(0,188,138,0.07)',
                border: '1px solid rgba(0,188,138,0.25)',
                borderRadius: 8, fontSize: 12, color: 'var(--muted)',
              }}>
                <strong style={{ color: 'var(--secondary)', display: 'block', marginBottom: 4 }}>
                  ✅ Recomendado: OpenRouter (gratuito para começar)
                </strong>
                Crie sua chave gratuita em{' '}
                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"
                  style={{ color: 'var(--secondary)' }}>
                  openrouter.ai/keys
                </a>{' '}
                — dá acesso a dezenas de modelos, incluindo modelos grátis como Llama e Gemma.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {PROVIDER_OPTIONS.map(p => {
                  const status = keyStatuses[p.key];
                  return (
                    <div key={p.key} className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        {p.label}
                        {p.key === 'openrouter' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#00BC8A', background: 'rgba(0,188,138,0.12)', padding: '1px 6px', borderRadius: 4 }}>
                            RECOMENDADO
                          </span>
                        )}
                        {status === 'validating' && <span style={{ fontSize: 11, color: 'var(--muted)' }}>verificando...</span>}
                        {status === 'valid' && <span style={{ fontSize: 11, color: 'var(--success)' }}>✅ válida</span>}
                        {status === 'invalid' && <span style={{ fontSize: 11, color: 'var(--danger)' }}>❌ inválida</span>}
                      </label>
                      <input
                        type="password"
                        value={apiKeys[p.key]}
                        onChange={e => {
                          setApiKeys(k => ({ ...k, [p.key]: e.target.value }));
                          setKeyStatuses(s => ({ ...s, [p.key]: 'idle' }));
                        }}
                        onBlur={e => { if (e.target.value.trim().length > 10) validateKey(p.key, e.target.value); }}
                        placeholder={p.placeholder}
                        autoComplete="off"
                        style={status === 'valid' ? { borderColor: 'var(--success)' } : status === 'invalid' ? { borderColor: 'var(--danger)' } : {}}
                      />
                      <small style={{ color: 'var(--muted)', fontSize: 11 }}>{p.hint}</small>
                    </div>
                  );
                })}
              </div>

              {!hasAtLeastOneKey && (
                <div style={{
                  marginTop: 14, padding: '10px 12px',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8, fontSize: 12, color: '#f87171',
                }}>
                  Insira pelo menos uma chave de API para continuar. Sem ela, os agentes não conseguem responder.
                </div>
              )}

              {apiKeyError && (
                <div style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)' }}>
                  ❌ {apiKeyError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="ghost" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: 'center' }}>
                  ← Voltar
                </button>
                <button
                  onClick={saveApiKeys}
                  disabled={apiKeySaving || !hasAtLeastOneKey}
                  style={{ flex: 2, justifyContent: 'center' }}
                >
                  {apiKeySaving ? 'Salvando...' : 'Próximo →'}
                </button>
              </div>
            </>
          )}

          {/* ── Step 4: Modelo do CEO ── */}
          {step === 4 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Modelo do CEO</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                Um agente CEO será criado automaticamente para orquestrar sua equipe.
                Ele vai montar um plano de ação e começar a contratar os outros agentes.
              </p>

              <ModelPicker
                value={data.ceoModel}
                onChange={model => setData(d => ({ ...d, ceoModel: model }))}
                modo="cards"
                mostrarPagos={false}
                label=""
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="ghost" onClick={() => setStep(3)} style={{ flex: 1, justifyContent: 'center' }}>
                  ← Voltar
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{ flex: 2, justifyContent: 'center' }}
                >
                  {loading ? 'Configurando workspace...' : '🚀 Finalizar'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
