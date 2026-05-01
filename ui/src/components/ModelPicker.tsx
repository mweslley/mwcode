import { useState, useRef, useEffect } from 'react';
import { MODELOS_OPENROUTER, MODELOS_DESTAQUE, type ModeloIA } from '@mwcode/shared';
import { api } from '../lib/api';

interface RemoteModel {
  id: string;
  name: string;
  description?: string;
  free?: boolean;
  contextLength?: number;
}

interface Props {
  value: string;
  onChange: (modelId: string) => void;
  mostrarPagos?: boolean;
  modo?: 'select' | 'cards';
  label?: string;
  provider?: string;
}

// ── Searchable combobox ───────────────────────────────────────────────────────

function SearchableSelect({
  value, onChange, localModels, remoteModels, loading,
}: {
  value: string;
  onChange: (id: string) => void;
  localModels: ModeloIA[];
  remoteModels: RemoteModel[] | null;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // All items merged: remote preferred when available
  const allItems: Array<{ id: string; name: string; free: boolean; desc?: string }> =
    remoteModels
      ? remoteModels.map(m => ({ id: m.id, name: m.name || m.id, free: m.free ?? false, desc: m.description }))
      : localModels.map(m => ({ id: m.id, name: m.nome, free: m.gratis, desc: m.descricao }));

  const q = search.toLowerCase().trim();
  const filtered = q
    ? allItems.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))
    : allItems;

  const currentName = allItems.find(m => m.id === value)?.name || value || 'Selecionar modelo...';

  // Close on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!dropRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  function select(id: string) {
    onChange(id);
    setSearch('');
    setOpen(false);
  }

  const freeItems = filtered.filter(m => m.free);
  const paidItems = filtered.filter(m => !m.free);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center',
          border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--bg-2)', overflow: 'hidden',
        }}
      >
        <input
          ref={inputRef}
          value={open ? search : ''}
          placeholder={open ? 'Pesquisar modelo...' : currentName}
          onChange={e => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          style={{
            flex: 1, border: 'none', background: 'transparent',
            padding: '8px 10px', fontSize: 13, color: 'var(--fg)',
            outline: 'none',
          }}
        />
        <span
          onClick={() => setOpen(o => !o)}
          style={{ padding: '0 10px', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}
        >
          {loading ? '⏳' : open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div
          ref={dropRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            zIndex: 200, marginTop: 2,
            background: 'var(--bg-2)', border: '1px solid var(--border)',
            borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            maxHeight: 280, overflowY: 'auto',
          }}
        >
          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px', color: 'var(--muted)', fontSize: 13 }}>
              Nenhum modelo encontrado
            </div>
          ) : (
            <>
              {freeItems.length > 0 && (
                <div>
                  <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, color: '#00bc8a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Gratuitos
                  </div>
                  {freeItems.map(m => (
                    <ModelRow key={m.id} m={m} selected={value === m.id} onSelect={select} />
                  ))}
                </div>
              )}
              {paidItems.length > 0 && (
                <div>
                  <div style={{ padding: '6px 12px 3px', fontSize: 10, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Pagos (requer créditos)
                  </div>
                  {paidItems.map(m => (
                    <ModelRow key={m.id} m={m} selected={value === m.id} onSelect={select} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ModelRow({ m, selected, onSelect }: {
  m: { id: string; name: string; free: boolean; desc?: string };
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div
      onMouseDown={() => onSelect(m.id)}
      style={{
        padding: '7px 12px',
        cursor: 'pointer',
        background: selected ? 'rgba(146,48,249,0.12)' : 'transparent',
        borderLeft: selected ? '2px solid var(--primary)' : '2px solid transparent',
        display: 'flex', alignItems: 'center', gap: 8,
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-3)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {m.name}
        </div>
        {m.desc && (
          <div style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {m.desc}
          </div>
        )}
      </div>
      <span style={{
        fontSize: 10, fontWeight: 700, flexShrink: 0, padding: '1px 6px', borderRadius: 4,
        color: m.free ? '#00bc8a' : '#f59e0b',
        background: m.free ? 'rgba(0,188,138,0.1)' : 'rgba(245,158,11,0.1)',
      }}>
        {m.free ? 'GRÁTIS' : 'PAGO'}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ModelPicker({
  value, onChange, mostrarPagos = true, modo = 'select', label = 'Modelo de IA', provider,
}: Props) {
  const [remoteModels, setRemoteModels] = useState<RemoteModel[] | null>(null);
  const [loadingRemote, setLoadingRemote] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'gratis'>(mostrarPagos ? 'todos' : 'gratis');

  async function fetchRemoteModels() {
    if (remoteModels !== null || loadingRemote) return;
    setLoadingRemote(true);
    try {
      const p = provider || 'openrouter';
      const list = await api.get<RemoteModel[]>(`/models/list?provider=${p}`);
      if (list && list.length > 0) setRemoteModels(list);
    } catch {
      // fallback to static list
    } finally {
      setLoadingRemote(false);
    }
  }

  // Lazy-load remote models when component mounts (for select mode)
  useEffect(() => {
    if (modo === 'select') fetchRemoteModels();
  }, []);

  const localModels = filtro === 'gratis'
    ? MODELOS_OPENROUTER.filter(m => m.gratis)
    : MODELOS_OPENROUTER;

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {MODELOS_DESTAQUE.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              style={{
                padding: '10px 12px', borderRadius: 10,
                border: `1.5px solid ${value === m.id ? 'var(--primary)' : 'var(--border)'}`,
                background: value === m.id ? 'rgba(146,48,249,0.08)' : 'transparent',
                color: 'inherit', cursor: 'pointer', textAlign: 'left',
                display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4, gap: 4 }}>
                <strong style={{ fontSize: 13 }}>{m.nome}</strong>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#00bc8a', background: 'rgba(0,188,138,0.12)', padding: '2px 6px', borderRadius: 6, whiteSpace: 'nowrap' }}>GRÁTIS</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 6px', lineHeight: 1.4 }}>{m.descricao}</p>
              <small style={{ fontSize: 10, color: 'var(--muted)' }}>📦 {m.contexto} · {m.melhorPara[0]}</small>
            </button>
          ))}
        </div>

        <details style={{ marginTop: 12 }} onToggle={e => (e.currentTarget as any).open && fetchRemoteModels()}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--muted)' }}>
            {loadingRemote ? 'Carregando modelos...' : `Ver todos os modelos (${remoteModels?.length ?? MODELOS_OPENROUTER.length})`}
          </summary>
          <div style={{ marginTop: 8 }}>
            <SearchableSelect
              value={value}
              onChange={onChange}
              localModels={MODELOS_OPENROUTER}
              remoteModels={remoteModels}
              loading={loadingRemote}
            />
          </div>
        </details>
      </div>
    );
  }

  // ── Select mode ───────────────────────────────────────────────────────────
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}

      {mostrarPagos && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <button type="button" onClick={() => setFiltro('todos')} style={filtro === 'todos' ? filtroAtivo : filtroInativo}>Todos</button>
          <button type="button" onClick={() => setFiltro('gratis')} style={filtro === 'gratis' ? filtroAtivo : filtroInativo}>🆓 Só grátis</button>
        </div>
      )}

      <SearchableSelect
        value={value}
        onChange={onChange}
        localModels={localModels}
        remoteModels={remoteModels}
        loading={loadingRemote}
      />

      <ModelHint modelId={value} />

      {!MODELOS_OPENROUTER.find(m => m.gratis && m.id === value) &&
       value && value !== 'openrouter/auto' &&
       !value.endsWith(':free') && (
        <small style={{ display: 'block', marginTop: 6, fontSize: 11, color: '#f97316' }}>
          ⚠️ Modelo pago — você precisa ter créditos na sua conta OpenRouter para usá-lo.
        </small>
      )}
    </div>
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

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 };
const filtroAtivo: React.CSSProperties = { padding: '4px 10px', fontSize: 12, border: '1px solid var(--primary)', background: 'var(--primary)', color: '#fff', borderRadius: 6, cursor: 'pointer' };
const filtroInativo: React.CSSProperties = { padding: '4px 10px', fontSize: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', borderRadius: 6, cursor: 'pointer' };
