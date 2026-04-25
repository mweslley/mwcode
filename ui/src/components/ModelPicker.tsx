import { useState } from 'react';
import { MODELOS_OPENROUTER, MODELOS_GRATIS, MODELOS_DESTAQUE } from '@mwcode/shared';

interface Props {
  value: string;
  onChange: (modelId: string) => void;
  /** Mostrar todos (incluindo pagos) ou só grátis. Padrão: true (todos). */
  mostrarPagos?: boolean;
  /** Mostrar como dropdown compacto ou cards. Padrão: 'select'. */
  modo?: 'select' | 'cards';
  label?: string;
}

/**
 * Seletor de modelo de IA — substitui o dropdown manual.
 *
 * Variantes:
 *   - 'select': dropdown agrupado (✨ destaques | 🆓 grátis | 💎 pagos)
 *   - 'cards':  cards visuais com descrição (pra Onboarding e Hire)
 */
export function ModelPicker({
  value,
  onChange,
  mostrarPagos = true,
  modo = 'select',
  label = 'Modelo de IA',
}: Props) {
  const [filtro, setFiltro] = useState<'todos' | 'gratis'>(
    mostrarPagos ? 'todos' : 'gratis'
  );

  const modelos = filtro === 'gratis' ? MODELOS_GRATIS : MODELOS_OPENROUTER;

  if (modo === 'cards') {
    return (
      <div>
        {label && (
          <label style={labelStyle}>
            {label}
            <small style={{ marginLeft: 8, color: 'var(--muted)' }}>
              ({MODELOS_DESTAQUE.length} recomendados — todos grátis)
            </small>
          </label>
        )}
        <div style={cardsGrid}>
          {MODELOS_DESTAQUE.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              style={{
                ...cardStyle,
                ...(value === m.id ? cardSelected : {}),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>{m.nome}</strong>
                <span style={badgeFree}>GRÁTIS</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 8px' }}>
                {m.descricao}
              </p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <small style={tagStyle}>📦 {m.contexto}</small>
                {m.melhorPara.slice(0, 2).map((tag) => (
                  <small key={tag} style={tagStyle}>{tag}</small>
                ))}
              </div>
            </button>
          ))}
        </div>
        <details style={{ marginTop: 12 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
            Ver todos os modelos ({MODELOS_OPENROUTER.length})
          </summary>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ marginTop: 8, width: '100%' }}
          >
            <SelectOptions modelos={MODELOS_OPENROUTER} />
          </select>
        </details>
      </div>
    );
  }

  // Modo select (dropdown)
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      {mostrarPagos && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button
            type="button"
            onClick={() => setFiltro('todos')}
            style={filtro === 'todos' ? filtroAtivo : filtroInativo}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => setFiltro('gratis')}
            style={filtro === 'gratis' ? filtroAtivo : filtroInativo}
          >
            🆓 Só grátis
          </button>
        </div>
      )}
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%' }}>
        <SelectOptions modelos={modelos} />
      </select>
      <ModelHint modelId={value} />
    </div>
  );
}

function SelectOptions({ modelos }: { modelos: typeof MODELOS_OPENROUTER }) {
  const destaques = modelos.filter((m) => m.destaque);
  const outrosGratis = modelos.filter((m) => m.gratis && !m.destaque);
  const pagos = modelos.filter((m) => !m.gratis);
  return (
    <>
      {destaques.length > 0 && (
        <optgroup label="✨ Recomendados (grátis)">
          {destaques.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </optgroup>
      )}
      {outrosGratis.length > 0 && (
        <optgroup label="🆓 Outros grátis">
          {outrosGratis.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </optgroup>
      )}
      {pagos.length > 0 && (
        <optgroup label="💎 Pagos (premium)">
          {pagos.map((m) => (
            <option key={m.id} value={m.id}>{m.nome}</option>
          ))}
        </optgroup>
      )}
    </>
  );
}

function ModelHint({ modelId }: { modelId: string }) {
  const m = MODELOS_OPENROUTER.find((x) => x.id === modelId);
  if (!m) return null;
  return (
    <small style={{ display: 'block', marginTop: 6, color: 'var(--muted)', fontSize: 12 }}>
      {m.gratis ? '🆓 ' : '💎 '} {m.descricao}
    </small>
  );
}

// === Estilos inline ===
const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: 6,
  fontSize: 13,
  fontWeight: 600,
};
const cardsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 10,
};
const cardStyle: React.CSSProperties = {
  padding: 14,
  borderRadius: 10,
  border: '1.5px solid var(--border)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s, transform 0.15s',
};
const cardSelected: React.CSSProperties = {
  borderColor: 'var(--primary)',
  background: 'rgba(146, 48, 249, 0.08)',
  transform: 'translateY(-2px)',
};
const badgeFree: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#00BC8A',
  background: 'rgba(0, 188, 138, 0.12)',
  padding: '2px 8px',
  borderRadius: 6,
  letterSpacing: 0.5,
};
const tagStyle: React.CSSProperties = {
  fontSize: 11,
  padding: '2px 8px',
  borderRadius: 4,
  background: 'rgba(255,255,255,0.05)',
  color: 'var(--muted)',
};
const filtroAtivo: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid var(--primary)',
  background: 'var(--primary)',
  color: '#fff',
  borderRadius: 6,
  cursor: 'pointer',
};
const filtroInativo: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--muted)',
  borderRadius: 6,
  cursor: 'pointer',
};
