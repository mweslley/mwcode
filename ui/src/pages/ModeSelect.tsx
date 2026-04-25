import { useNavigate } from 'react-router-dom';

/**
 * Tela de escolha de modo, exibida logo após o login.
 * Salva a escolha em localStorage('mode') = 'personal' | 'enterprise'.
 *
 * - Pessoal     → vai direto pro chat (modo individual, 1 agente)
 * - Empresa     → vai pro onboarding (criar empresa, hierarquia, agentes)
 *
 * Pra trocar de modo depois: limpar localStorage('mode') ou
 * usar a opção em Configurações.
 */
export function ModeSelect() {
  const navigate = useNavigate();
  const userJson = localStorage.getItem('user');
  const userName = userJson ? JSON.parse(userJson).name?.split(' ')[0] : '';

  function escolherPessoal() {
    localStorage.setItem('mode', 'personal');
    navigate('/single');
  }

  function escolherEmpresa() {
    localStorage.setItem('mode', 'enterprise');
    // Se já tem empresa cadastrada, vai direto pro painel; senão, onboarding
    if (localStorage.getItem('company')) {
      navigate('/dashboard');
    } else {
      navigate('/onboarding');
    }
  }

  return (
    <div className="mode-select-page">
      <div className="mode-select-container">
        <header className="mode-select-header">
          <h1>{userName ? `Olá, ${userName}!` : 'Bem-vindo ao MWCode'}</h1>
          <p>Como você quer usar o MWCode?</p>
        </header>

        <div className="mode-cards">
          <button className="mode-card mode-personal" onClick={escolherPessoal}>
            <div className="mode-icon">👤</div>
            <h2>Pessoal</h2>
            <p className="mode-tagline">Para uso individual</p>
            <ul className="mode-features">
              <li>✓ Chat direto com 1 agente</li>
              <li>✓ Múltiplos provedores (OpenRouter, OpenAI, Gemini, Ollama)</li>
              <li>✓ Memórias e skills personalizadas</li>
              <li>✓ Configuração mínima — começa em segundos</li>
            </ul>
            <div className="mode-cta">Começar como pessoal →</div>
          </button>

          <button className="mode-card mode-enterprise" onClick={escolherEmpresa}>
            <div className="mode-icon">🏢</div>
            <h2>Empresa</h2>
            <p className="mode-tagline">Para empresas e equipes</p>
            <ul className="mode-features">
              <li>✓ Múltiplos agentes (CEO, CTO, Engs, etc.)</li>
              <li>✓ Hierarquia organizacional</li>
              <li>✓ Contratar / demitir agentes</li>
              <li>✓ Painel com custos, desempenho e tarefas</li>
            </ul>
            <div className="mode-cta">Configurar empresa →</div>
          </button>
        </div>

        <footer className="mode-select-footer">
          <p>
            Você pode trocar de modo a qualquer momento em{' '}
            <strong>Configurações</strong>.
          </p>
          <a
            href="/login"
            onClick={() => {
              localStorage.clear();
            }}
            className="mode-logout"
          >
            Sair da conta
          </a>
        </footer>
      </div>
    </div>
  );
}
