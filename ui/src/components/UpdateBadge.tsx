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
 * Badge que aparece SOMENTE quando há nova versão do MWCode disponível.
 * Quando o sistema está atualizado, não renderiza nada.
 */
export function UpdateBadge() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [erroUpdate, setErroUpdate] = useState<string | null>(null);

  async function checar() {
    try {
      const res = await api.get<UpdateInfo>('/system/update-check');
      setInfo(res);
    } catch {
      // falha silenciosa — não queremos banner de erro aqui
    }
  }

  useEffect(() => {
    checar();
    const id = setInterval(checar, 60 * 60 * 1000); // re-checa a cada 1h
    return () => clearInterval(id);
  }, []);

  async function atualizarAgora() {
    if (!confirm('Confirma atualizar o MWCode?\n\nO servidor vai reiniciar e a página recarregará em ~30s.')) return;
    setAtualizando(true);
    setErroUpdate(null);
    try {
      await api.post('/system/update', {});
      // Polling até servidor voltar (evita ERR_CONNECTION_REFUSED)
      let attempts = 0;
      const poll = setInterval(async () => {
        attempts++;
        try {
          const r = await fetch('/api/health');
          if (r.ok) { clearInterval(poll); window.location.reload(); }
        } catch { /* servidor ainda offline */ }
        if (attempts > 60) { clearInterval(poll); window.location.reload(); }
      }, 3000);
    } catch (e: any) {
      setErroUpdate(e?.message || 'Falha ao iniciar atualização.');
      setAtualizando(false);
    }
  }

  // Só renderiza quando há atualização disponível
  if (!info?.temAtualizacao) return null;

  return (
    <div style={{
      background: 'rgba(245,158,11,0.12)',
      border: '1px solid rgba(245,158,11,0.35)',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fbbf24' }}>
            ⬆️ Nova versão disponível!
          </div>
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--fg-2)' }}>
            Atual: <code style={{ fontSize: 11 }}>{info.atual.sha}</code>
            {' → '}
            Nova: <code style={{ fontSize: 11 }}>{info.ultima?.sha}</code>
          </div>
          {info.ultima?.message && (
            <div style={{ fontSize: 12, marginTop: 4, color: 'var(--muted)', fontStyle: 'italic' }}>
              "{info.ultima.message}"
            </div>
          )}
        </div>
        <button
          onClick={atualizarAgora}
          disabled={atualizando}
          style={{
            padding: '9px 18px', borderRadius: 8,
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid rgba(245,158,11,0.45)',
            color: '#fbbf24', fontWeight: 700, fontSize: 13,
            cursor: atualizando ? 'wait' : 'pointer',
          }}
        >
          {atualizando ? '⏳ Atualizando…' : '🔄 Atualizar agora'}
        </button>
      </div>
      {atualizando && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>
          Servidor reiniciando — a página vai recarregar em alguns segundos.
        </div>
      )}
      {erroUpdate && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', background: 'rgba(244,63,94,0.1)', padding: '6px 10px', borderRadius: 6 }}>
          ❌ {erroUpdate}
        </div>
      )}
    </div>
  );
}
