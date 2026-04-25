import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

interface OnboardingData {
  companyName: string;
  area: string;
  mission: string;
  employees: string;
  goals: string[];
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
    goals: []
  });
  const [goalInput, setGoalInput] = useState('');

  async function handleSubmit() {
    setLoading(true);
    try {
      // Salvar dados da empresa no backend
      const company = await api.post('/enterprise/company', data);

      // Criar agente CEO inicial
      await api.post('/enterprise/agents/hire', {
        name: 'CEO',
        role: 'ceo',
        title: 'Chief Executive Officer',
        personality: `Você é o CEO da ${data.companyName}. Sua missão é: ${data.mission}`,
        goals: data.goals,
        provider: 'openrouter',
        model: 'deepseek/deepseek-coder'
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

            <button 
              onClick={handleSubmit} 
              disabled={loading || (data.goals.length === 0)}
              className="submit-btn"
            >
              {loading ? 'Criando...' : 'Finalizar! 🎉'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}