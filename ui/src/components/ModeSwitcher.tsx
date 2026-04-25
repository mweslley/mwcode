import { useNavigate } from 'react-router-dom';

/**
 * Banner compacto no topo das páginas mostrando o modo atual com botão "Trocar".
 *
 * Importante: trocar de modo NÃO apaga dados.
 * - Empresa, agentes, memórias e skills ficam guardados no servidor.
 * - localStorage mantém token + user + company; só o 'mode' é removido.
 * - O usuário pode voltar pro modo anterior quando quiser e tudo continua.
 */
export function ModeSwitcher() {
  const navigate = useNavigate();
  const mode = localStorage.getItem('mode');
  const ehPessoal = mode === 'personal';

  function trocar() {
    const ok = confirm(
      'Trocar de modo?\n\n' +
      'Seus dados ficam salvos:\n' +
      '  • Empresa, agentes e tarefas (modo Empresa)\n' +
      '  • Memórias e skills (modo Pessoal)\n\n' +
      'Você pode voltar quando quiser — tudo continua de onde parou.'
    );
    if (!ok) return;
    localStorage.removeItem('mode');
    navigate('/mode');
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '10px 16px',
        marginBottom: 16,
        borderRadius: 10,
        background: ehPessoal ? '#3b82f615' : '#8b5cf615',
        border: `1px solid ${ehPessoal ? '#3b82f6' : '#8b5cf6'}40`,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <span style={{ fontSize: 18 }}>{ehPessoal ? '👤' : '🏢'}</span>
        <span style={{ fontSize: 14 }}>
          Você está no modo{' '}
          <strong>{ehPessoal ? 'Pessoal' : 'Empresa'}</strong>
        </span>
      </div>
      <button
        onClick={trocar}
        style={{
          padding: '6px 14px',
          borderRadius: 8,
          border: `1px solid ${ehPessoal ? '#3b82f6' : '#8b5cf6'}`,
          background: 'transparent',
          color: ehPessoal ? '#3b82f6' : '#8b5cf6',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          whiteSpace: 'nowrap',
        }}
      >
        🔄 Trocar modo
      </button>
    </div>
  );
}
