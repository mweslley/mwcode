import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { ModelPicker } from '../components/ModelPicker';
import { MODELO_PADRAO } from '@mwcode/shared';

const TOTAL_STEPS = 3;

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    companyName: '',
    area: '',
    mission: '',
    employees: '1-10',
    goals: [] as string[],
    ceoModel: MODELO_PADRAO,
  });
  const [goalInput, setGoalInput] = useState('');

  function addGoal() {
    if (goalInput.trim()) {
      setData(d => ({ ...d, goals: [...d.goals, goalInput.trim()] }));
      setGoalInput('');
    }
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      const company = await api.post<any>('/enterprise/company', data);

      const ceo = await api.post<any>('/enterprise/agents/hire', {
        name: 'CEO',
        role: 'ceo',
        title: 'CEO — Chief Executive Officer',
        personality:
          `Você é o CEO da ${data.companyName}, responsável por orquestrar e administrar a empresa. ` +
          `Atua na área de ${data.area || 'negócios'}. ` +
          `Sua missão: ${data.mission || 'fazer a empresa crescer com agentes de IA'}. ` +
          `Você toma decisões estratégicas, contrata e gerencia outros agentes de IA para compor sua equipe, ` +
          `delega tarefas, monitora o desempenho da equipe e reporta resultados ao usuário. ` +
          `Ao ser iniciado pela primeira vez, analise os objetivos da empresa e elabore um plano de ação ` +
          `com os primeiros agentes a contratar e as primeiras tarefas a executar. ` +
          `Sempre responda em português brasileiro de forma direta e profissional.`,
        goals: data.goals,
        provider: 'openrouter',
        model: data.ceoModel,
      });

      // Boot do CEO: mensagem inicial para o CEO começar a agir
      if (ceo?.id) {
        const bootMsg =
          `Você acabou de ser contratado como CEO da ${data.companyName}. ` +
          (data.mission ? `Nossa missão é: ${data.mission}. ` : '') +
          (data.goals.length > 0 ? `Nossos objetivos principais são: ${data.goals.join(', ')}. ` : '') +
          `Analise essa situação e me apresente: ` +
          `1) Quais agentes você recomenda contratar primeiro e por quê. ` +
          `2) As 3 primeiras ações que vai tomar como CEO. ` +
          `3) Como vai medir o sucesso nas próximas semanas. ` +
          `Seja direto e prático.`;

        await api.post(`/chat/${ceo.id}`, { message: bootMsg }).catch(() => {});
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

  return (
    <div className="onboarding-page">
      <div className="onboarding-box">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Bem-vindo ao MWCode
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Configure seu workspace em 3 passos rápidos
          </p>
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
                  rows={4}
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
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 10px',
                        background: 'var(--bg-3)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        fontSize: 13,
                      }}>
                        <span style={{ flex: 1 }}>✅ {g}</span>
                        <button
                          className="ghost"
                          style={{ padding: '2px 8px', fontSize: 12 }}
                          onClick={() => setData(d => ({ ...d, goals: d.goals.filter((_, j) => j !== i) }))}
                        >
                          ×
                        </button>
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

          {step === 3 && (
            <>
              <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Modelo do CEO</h2>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
                Um agente CEO será criado automaticamente para orquestrar sua equipe.
                Escolha o modelo de IA dele:
              </p>

              <ModelPicker
                value={data.ceoModel}
                onChange={model => setData(d => ({ ...d, ceoModel: model }))}
                modo="cards"
                mostrarPagos={false}
                label=""
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button className="ghost" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: 'center' }}>
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
