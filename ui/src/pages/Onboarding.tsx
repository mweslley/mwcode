import { useState } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { ModelPicker } from '../components/ModelPicker';
import { MODELO_PADRAO } from '@mwcode/shared';

interface OnboardingData {
  companyName: string;
  area: string;
  mission: string;
  employees: string;
  goals: string[];
  ceoModel: string;
}

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    area: '',
    mission: '',
    employees: '1-10',
    goals: [],
    ceoModel: MODELO_PADRAO
  });
  const [goalInput, setGoalInput] = useState('');

  async function handleSubmit() {
    setLoading(true);
    try {
      // Salvar dados da empresa no backend
      const company = await api.post('/enterprise/company', data);

      // Criar agente CEO inicial — administra e orquestra a empresa.
      // Modelo padrão é openrouter/auto (grátis, escolhido em runtime).
      // Usuário pode trocar depois em Agentes → CEO → editar.
      await api.post('/enterprise/agents/hire', {
        name: 'CEO',
        role: 'ceo',
        title: 'CEO — Chief Executive Officer',
        personality:
          `Você é o CEO da ${data.companyName}, responsável por orquestrar e administrar a empresa. ` +
          `Atua na área de ${data.area || 'negócios'}. ` +
          `Sua missão: ${data.mission || 'fazer a empresa crescer com agentes de IA'}. ` +
          `Você toma decisões estratégicas, atribui tarefas a outros agentes, ` +
          `monitora o desempenho da equipe e reporta resultados ao usuário. ` +
          `Sempre responda em português brasileiro de forma direta e profissional.`,
        goals: data.goals,
        provider: 'openrouter',
        model: data.ceoModel
      });

      // IMPORTANTE: salvar no localStorage pra CheckOnboarding não voltar pra cá em loop
      localStorage.setItem('company', JSON.stringify(company || data));

      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      alert('Erro ao criar empresa: ' + (err?.message || 'tente novamente.'));
    } finally {
      setLoading(false);
    }
  }

  function addGoal() {
    if (goalInput.trim()) {
      setData({ ...data, goals: [...data.goals, goalInput] });
      setGoalInput('');
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-progress">
          <div className={`progress-step ${step >= 1 ? 'active' : ''}`}>1</div>
          <div className="progress-line" />
          <div className={`progress-step ${step >= 2 ? 'active' : ''}`}>2</div>
          <div className="progress-line" />
          <div className={`progress-step ${step >= 3 ? 'active' : ''}`}>3</div>
        </div>

        {step === 1 && (
          <div className="onboarding-step">
            <h1>Vamos conhecer sua empresa!</h1>
            <p>Primeiro, nos conte sobre o básico.</p>
            
            <div className="form-group">
              <label>Nome da empresa</label>
              <input
                type="text"
                value={data.companyName}
                onChange={(e) => setData({ ...data, companyName: e.target.value })}
                placeholder="Minha Empresa"
              />
            </div>

            <div className="form-group">
              <label>Área de atuação</label>
              <input
                type="text"
                value={data.area}
                onChange={(e) => setData({ ...data, area: e.target.value })}
                placeholder="Tecnologia, Saúde, Educação..."
              />
            </div>

            <div className="form-group">
              <label>Número de funcionários</label>
              <select
                value={data.employees}
                onChange={(e) => setData({ ...data, employees: e.target.value })}
              >
                <option value="1-10">1-10</option>
                <option value="11-50">11-50</option>
                <option value="51-200">51-200</option>
                <option value="200+">200+</option>
              </select>
            </div>

            <button onClick={() => data.companyName && setStep(2)} disabled={!data.companyName}>
              Próximo →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="onboarding-step">
            <h1>Missão e Valores</h1>
            <p>Qual é o propósito da sua empresa?</p>
            
            <div className="form-group">
              <label>Missão</label>
              <textarea
                value={data.mission}
                onChange={(e) => setData({ ...data, mission: e.target.value })}
                placeholder="Nossa missão é..."
                rows={4}
              />
            </div>

            <button onClick={() => setStep(3)} disabled={!data.mission}>
              Próximo →
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="onboarding-step">
            <h1>Metas da Empresa</h1>
            <p>Quais são as principais metas para os próximos meses?</p>
            
            <div className="goals-list">
              {data.goals.map((goal, i) => (
                <div key={i} className="goal-item">
                  <span>{goal}</span>
                  <button onClick={() => setData({ 
                    ...data, 
                    goals: data.goals.filter((_, j) => j !== i) 
                  })}>×</button>
                </div>
              ))}
            </div>

            <div className="goal-input">
              <input
                type="text"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder="Adicionar meta..."
                onKeyDown={(e) => e.key === 'Enter' && addGoal()}
              />
              <button onClick={addGoal}>+</button>
            </div>

            <div className="form-group" style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>Modelo de IA do CEO</h3>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                Será criado automaticamente um agente <strong>CEO</strong> pra orquestrar
                sua empresa. Escolha o modelo de IA dele (todos grátis):
              </p>
              <ModelPicker
                value={data.ceoModel}
                onChange={(modelId) => setData({ ...data, ceoModel: modelId })}
                modo="cards"
                mostrarPagos={false}
                label=""
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || (data.goals.length === 0)}
              className="submit-btn"
            >
              {loading ? 'Criando empresa e CEO...' : 'Finalizar! 🎉'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}