import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface UpdateInfo {
  temAtualizacao: boolean;
  atual: { sha: string; message: string; date: string };
  ultima?: { sha: string; message: string; date: string };
  mensagem: string;
  erro?: string;
}

/**
 * Badge na Dashboard que avisa quando há nova versão do MWCode disponível.
 * Permite o usuário atualizar com 1 clique (chama POST /api/system/update).
 *
 * - Checa a cada 1h (ou ao abrir a Dashboard)
 * - Quando há atualização: mostra card destacado com botão "Atualizar agora"
 * - Quando atualizado: mostra estado discreto (versão atual)
 * - Após clicar atualizar: avisa que servidor vai reiniciar e recarrega a página em 30s
 */
export function UpdateBadge() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erroUpdate, setErroUpdate] = useState<string | null>(null);

  async function checar() {
    setCarregando(true);
    try {
      const res = await api.get<UpdateInfo>('/system/update-check');
      setInfo(res);
    } catch (e: any) {
      setInfo({
        temAtualizacao: false,
        atual: { sha: '?', message: '?', date: '' },
        mensagem: 'Não foi possível verificar atualização.',
        erro: e?.message || 'Erro desconhecido',
      });
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    checar();
    // Re-checa a cada 1 hora enquanto a Dashboard está aberta
    const id = setInterval(checar, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  async function atualizarAgora() {
    if (!confirm('Confirma atualizar o MWCode?\n\nO servidor vai reiniciar e a página recarregará em ~30s.')) {
      return;
    }

    setAtualizando(true);
    setErroUpdate(null);
    try {
      await api.post('/system/update', {});
      // Servidor vai reiniciar — esperar e recarregar
      setTimeout(() => {
        window.location.reload();
      }, 30000);
    } catch (e: any) {
      setErroUpdate(e?.message || 'Falha ao iniciar atualização.');
      setAtualizando(false);
    }
  }

  if (carregando) {
    return (
      <div style={cardStyle('var(--muted)')}>
        <span style={{ fontSize: 14, opacity: 0.7 }}>Verificando atualizações…</span>
      </div>
    );
  }

  if (!info) return null;

  // Caso 1: erro ao consultar (não bloqueia, só informa)
  if (info.erro) {
    return (
      <div style={cardStyle('#94a3b8')}>
        <span style={{ fontSize: 14 }}>⚠️ {info.mensagem}</span>
      </div>
    );
  }

  // Caso 2: tem atualização disponível
  if (info.temAtualizacao) {
    return (
      <div style={cardStyle('#f59e0b', true)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              ⬆️ Nova versão disponível!
            </div>
            <div style={{ fontSize: 13, marginTop: 4, opacity: 0.85 }}>
              Atual: <code>{info.atual.sha}</code>
              {' → '}
              Nova: <code>{info.ultima?.sha}</code>
            </div>
            {info.ultima?.message && (
              <div style={{ fontSize: 12, marginTop: 6, opacity: 0.75, fontStyle: 'italic' }}>
                "{info.ultima.message}"
              </div>
            )}
          </div>
          <button
            onClick={atualizarAgora}
            disabled={atualizando}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#fff',
              color: '#b45309',
              fontWeight: 700,
              cursor: atualizando ? 'wait' : 'pointer',
              fontSize: 14,
            }}
          >
            {atualizando ? '⏳ Atualizando…' : '🔄 Atualizar agora'}
          </button>
        </div>
        {atualizando && (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
            Servidor reiniciando — a página vai recarregar em alguns segundos.
          </div>
        )}
        {erroUpdate && (
          <div style={{ marginTop: 10, fontSize: 13, color: '#fee', background: 'rgba(0,0,0,0.2)', padding: 8, borderRadius: 6 }}>
            ❌ {erroUpdate}
          </div>
        )}
      </div>
    );
  }

  // Caso 3: tudo atualizado
  return (
    <div style={cardStyle('#10b981')}>
      <span style={{ fontSize: 14 }}>
        ✓ MWCode atualizado{' '}
        <code style={{ fontSize: 12, opacity: 0.8 }}>{info.atual.sha}</code>
      </span>
    </div>
  );
}

function cardStyle(color: string, destaque = false): React.CSSProperties {
  return {
    background: destaque ? color : `${color}15`,
    border: `1px solid ${color}`,
    color: destaque ? '#fff' : color,
    borderRadius: 10,
    padding: destaque ? '14px 16px' : '8px 12px',
    marginBottom: 16,
  };
}
