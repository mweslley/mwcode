import { useState } from 'react';

interface Props {
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
}

export function HireModal({ onSubmit, onClose }: Props) {
  const [form, setForm] = useState({
    name: '',
    role: '',
    adapter: 'openrouter',
    model: 'openrouter/auto',
    skills: '',
    salary: 0
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        ...form,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean)
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50
    }}>
      <div className="card" style={{ width: 500, maxWidth: '90vw' }}>
        <h2>Contratar Agente</h2>

        <div className="form-group">
          <label>Nome</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Função</label>
          <input value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="ex: Desenvolvedor, Suporte, Copywriter" />
        </div>
        <div className="form-group">
          <label>Provedor</label>
          <select value={form.adapter} onChange={e => setForm({ ...form, adapter: e.target.value })}>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama (local)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="github">GitHub Models</option>
          </select>
        </div>
        <div className="form-group">
          <label>Modelo</label>
          <input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
        </div>
        <div className="form-group">
          <label>Habilidades (separadas por vírgula)</label>
          <input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} />
        </div>

        {error && <p style={{ color: 'var(--danger)', marginBottom: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ghost" onClick={onClose}>Cancelar</button>
          <button onClick={handle} disabled={submitting || !form.name || !form.role}>
            {submitting ? 'Contratando...' : 'Contratar'}
          </button>
        </div>
      </div>
    </div>
  );
}
