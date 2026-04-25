import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export function Settings() {
  const navigate = useNavigate();
  const [health, setHealth] = useState<any>(null);
  const [failoverOn, setFailoverOn] = useState(true);
  const mode = localStorage.getItem('mode');

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, []);

  function trocarModo() {
    if (
      confirm(
        'Trocar de modo? Você voltará pra tela de escolha (Pessoal ou Empresa).\n\nSeus dados não serão apagados — só o modo de uso.'
      )
    ) {
      localStorage.removeItem('mode');
      navigate('/mode');
    }
  }

  return (
    <div>
      <h1>Configurações</h1>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Modo de uso</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          Você está usando o MWCode como{' '}
          <strong>{mode === 'personal' ? '👤 Pessoal' : '🏢 Empresa'}</strong>.
        </p>
        <button
          onClick={trocarModo}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
          }}
        >
          🔄 Trocar modo
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Sistema</h2>
        {health ? (
          <ul style={{ listStyle: 'none', color: 'var(--muted)', fontSize: 13 }}>
            <li>Status: {health.status}</li>
            <li>Versão: {health.version}</li>
            <li>Modo: {health.modo}</li>
            <li>Provedor: {health.provider || '(não configurado)'}</li>
          </ul>
        ) : (
          <p style={{ color: 'var(--danger)' }}>API offline</p>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2>Failover Automático</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12 }}>
          Alterna automaticamente para provedor de backup quando o principal falha.
        </p>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={failoverOn}
            onChange={e => setFailoverOn(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Failover ativo (configure no servidor via MWCODE_FAILOVER=true)
        </label>
      </div>

      <div className="card">
        <h2>Provedores Suportados</h2>
        <ul style={{ listStyle: 'none', fontSize: 13, color: 'var(--muted)', lineHeight: 1.8 }}>
          <li>✅ OpenRouter — +100 modelos via uma API</li>
          <li>✅ OpenAI — GPT-4o, GPT-4o-mini</li>
          <li>✅ Gemini — Google Generative AI</li>
          <li>✅ Ollama — modelos locais (ilimitados)</li>
          <li>✅ DeepSeek — API DeepSeek</li>
          <li>✅ GitHub Models — inferência grátis</li>
        </ul>
      </div>
    </div>
  );
}
