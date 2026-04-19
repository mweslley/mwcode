import { useNavigate } from 'react-router-dom';

export function ModeSelect() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Bem-vindo ao MWCode</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
        Escolha o modo que melhor se adapta ao seu uso.
      </p>

      <div className="mode-select">
        <div className="mode-card" onClick={() => navigate('/single')}>
          <h3>👤 Modo Single</h3>
          <p>1 usuário, 1 agente. Chat direto com qualquer provedor (OpenRouter, OpenAI, Gemini, Ollama). Grátis e simples.</p>
        </div>

        <div className="mode-card" onClick={() => navigate('/dashboard')}>
          <h3>🏢 Modo Enterprise</h3>
          <p>Gestão completa para empresas. Contrate/demita agentes, veja custos, performance e histórico. Múltiplos agentes simultâneos.</p>
        </div>
      </div>
    </div>
  );
}
