import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface Company {
  id: string;
  name: string;
  area: string;
  mission: string;
  employees: string;
  goals: string[];
}

export function WorkspacePage() {
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ name: '', area: '', mission: '', employees: '1-10', goals: '' });
  const [goalInput, setGoalInput] = useState('');
  const [goals, setGoals] = useState<string[]>([]);

  useEffect(() => {
    api.get<Company>('/enterprise/company')
      .then(c => {
        if (c) {
          setCompany(c);
          setForm({ name: c.name || '', area: c.area || '', mission: c.mission || '', employees: c.employees || '1-10', goals: '' });
          setGoals(c.goals || []);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function addGoal() {
    if (goalInput.trim()) { setGoals(g => [...g, goalInput.trim()]); setGoalInput(''); }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await api.put<Company>('/enterprise/company', {
        name: form.name, area: form.area, mission: form.mission,
        employees: form.employees, goals,
      });
      setCompany(updated);
      localStorage.setItem('company', JSON.stringify(updated));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e: any) {
      alert('Erro ao salvar: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Área de Trabalho</h1></div>
      <div style={{ color: 'var(--muted)', padding: 32, textAlign: 'center' }}>Carregando...</div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Área de Trabalho</h1>
            <p className="page-subtitle">Edite as informações da sua empresa — os agentes usam isso para tomar decisões.</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="ghost"
              style={{ fontSize: 12 }}
              onClick={() => {
                if (confirm('Criar uma nova área de trabalho vai apagar toda a configuração atual (agentes, chats e dados). Continuar?')) {
                  localStorage.setItem('company_backup', JSON.stringify(company));
                  navigate('/onboarding');
                }
              }}
            >
              + Nova Área de Trabalho
            </button>
          </div>
        </div>
      </div>

      {!company ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🏢</div>
          <p style={{ fontWeight: 600, marginBottom: 12 }}>Nenhuma área de trabalho configurada</p>
          <button onClick={() => navigate('/onboarding')}>Configurar agora</button>
        </div>
      ) : (
        <div style={{ maxWidth: 560 }}>
          <div className="card" style={{ padding: '20px 22px', marginBottom: 16 }}>
            <div className="form-group">
              <label>Nome da empresa *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Loja MWO" />
            </div>
            <div className="form-group">
              <label>Área de atuação</label>
              <input value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} placeholder="Ex: Hosting, E-commerce, SaaS..." />
            </div>
            <div className="form-group">
              <label>Missão</label>
              <textarea
                value={form.mission}
                onChange={e => setForm(f => ({ ...f, mission: e.target.value }))}
                rows={3}
                placeholder="O que a empresa busca alcançar?"
              />
            </div>
            <div className="form-group">
              <label>Tamanho da equipe</label>
              <select value={form.employees} onChange={e => setForm(f => ({ ...f, employees: e.target.value }))}>
                <option value="1-10">1–10 pessoas</option>
                <option value="11-50">11–50 pessoas</option>
                <option value="51-200">51–200 pessoas</option>
                <option value="200+">200+ pessoas</option>
              </select>
            </div>

            <div className="form-group">
              <label>Objetivos</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addGoal())}
                  placeholder="Adicionar objetivo..."
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={addGoal} style={{ padding: '8px 14px' }}>+</button>
              </div>
              {goals.map((g, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', background: 'var(--bg-3)',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                  fontSize: 13, marginBottom: 6,
                }}>
                  <span style={{ flex: 1 }}>✅ {g}</span>
                  <button className="ghost" style={{ padding: '2px 8px', fontSize: 12 }}
                    onClick={() => setGoals(gs => gs.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>

            <button onClick={save} disabled={saving || !form.name} style={{ width: '100%', justifyContent: 'center' }}>
              {saving ? 'Salvando...' : saved ? '✅ Salvo!' : '💾 Salvar alterações'}
            </button>
          </div>

          {/* Danger zone */}
          <div className="card" style={{ padding: '16px 20px', borderColor: 'rgba(239,68,68,0.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#f87171', marginBottom: 8 }}>Zona de perigo</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="ghost"
                style={{ fontSize: 12, borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24' }}
                onClick={() => {
                  localStorage.setItem('company_backup', JSON.stringify(company));
                  navigate('/onboarding');
                }}
              >
                🔄 Reconfigurar área de trabalho
              </button>
              <button
                className="ghost"
                style={{ fontSize: 12, borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}
                onClick={async () => {
                  const name = prompt(`Para resetar, digite o nome da empresa:\n"${company.name}"`);
                  if (!name || name.trim().toLowerCase() !== company.name.trim().toLowerCase()) {
                    if (name !== null) alert('Nome incorreto.');
                    return;
                  }
                  if (!confirm('⚠️ Isso apaga tudo (empresa, agentes, chats). Continuar?')) return;
                  await api.delete('/enterprise/reset?mode=workspace').catch(() => {});
                  localStorage.removeItem('company');
                  navigate('/onboarding');
                }}
              >
                🗑 Apagar tudo e recomeçar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
