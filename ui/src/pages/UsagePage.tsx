import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Totals { tokens: number; costUsd: number; calls: number }
interface AgentUsage { name: string; tokens: number; costUsd: number; calls: number }
interface UsageData {
  totals: Totals;
  today: Totals;
  thisMonth: Totals;
  byAgent: Record<string, AgentUsage>;
  log: LogEntry[];
}
interface LogEntry {
  ts: string;
  agentId: string;
  agentName: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  source?: string;
}
interface Limits {
  global?: { dailyUsd?: number; monthlyUsd?: number };
  byAgent?: Record<string, { dailyUsd?: number; dailyTokens?: number }>;
}

const USD_BRL = 5.75; // taxa aproximada, atualizar conforme necessário

function fmt$(n: number, showBrl = false) {
  const usd = n === 0 ? '$0.00' : n < 0.001 ? '<$0.001' : '$' + n.toFixed(n < 0.01 ? 4 : 3);
  if (!showBrl || n === 0) return usd;
  const brl = 'R$' + (n * USD_BRL).toFixed(n * USD_BRL < 0.01 ? 4 : 2);
  return `${usd} (${brl})`;
}
function fmtK(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}
function pct(used: number, limit: number) {
  if (!limit) return 0;
  return Math.min(100, (used / limit) * 100);
}

function GaugeBar({ used, limit, color = '#9230f9' }: { used: number; limit: number; color?: string }) {
  const p = pct(used, limit);
  const warn = p > 80;
  const c = warn ? '#f97316' : color;
  return (
    <div style={{ height: 6, borderRadius: 4, background: 'var(--bg-3)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${p}%`, background: c, borderRadius: 4, transition: 'width 0.4s' }} />
    </div>
  );
}

function StatCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="card" style={{ padding: '14px 18px', flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: warn ? '#f97316' : 'var(--fg)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [limits, setLimits] = useState<Limits>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'overview' | 'log' | 'limits'>('overview');

  // Limits form state
  const [dailyUsd, setDailyUsd] = useState('');
  const [monthlyUsd, setMonthlyUsd] = useState('');

  async function load() {
    const [d, l] = await Promise.all([
      api.get<UsageData>('/usage').catch(() => null),
      api.get<Limits>('/usage/limits').catch(() => ({} as Limits)),
    ]);
    setData(d);
    setLimits(l || {});
    if (l?.global?.dailyUsd) setDailyUsd(String(l.global.dailyUsd));
    if (l?.global?.monthlyUsd) setMonthlyUsd(String(l.global.monthlyUsd));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveLimits() {
    setSaving(true);
    const body: Limits = {};
    if (dailyUsd || monthlyUsd) {
      body.global = {};
      if (dailyUsd) body.global.dailyUsd = parseFloat(dailyUsd) || 0;
      if (monthlyUsd) body.global.monthlyUsd = parseFloat(monthlyUsd) || 0;
    }
    await api.put('/usage/limits', body).catch(() => {});
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load();
  }

  async function resetUsage() {
    if (!confirm('Zerar todas as estatísticas de uso? Isso não pode ser desfeito.')) return;
    await api.delete('/usage/reset').catch(() => {});
    load();
  }

  if (loading) return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Uso de Tokens</h1></div>
      <div style={{ color: 'var(--muted)', padding: 32, textAlign: 'center' }}>Carregando...</div>
    </div>
  );

  const d = data;
  const hasData = d && d.totals.calls > 0;
  const monthWarn = limits.global?.monthlyUsd
    ? pct(d?.thisMonth.costUsd || 0, limits.global.monthlyUsd) > 80
    : false;

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title">Uso de Tokens</h1>
            <p className="page-subtitle">Consumo de IA em tempo real — tokens, custo estimado e limites de gasto.</p>
          </div>
          <button className="ghost" style={{ fontSize: 12 }} onClick={resetUsage}>🗑 Zerar estatísticas</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 18, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['overview', 'log', 'limits'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 12, padding: '6px 14px',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t ? 'var(--primary)' : 'var(--muted)',
              fontWeight: tab === t ? 700 : 400, cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t === 'overview' ? 'Visão Geral' : t === 'log' ? 'Histórico' : 'Limites de Gasto'}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <>
          {/* Stats row */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <StatCard label="Total de tokens" value={fmtK(d?.totals.tokens || 0)} sub={`${d?.totals.calls || 0} chamadas`} />
            <StatCard label="Custo estimado total" value={fmt$(d?.totals.costUsd || 0, true)} />
            <StatCard label="Hoje" value={fmtK(d?.today.tokens || 0)} sub={fmt$(d?.today.costUsd || 0, true)} />
            <StatCard
              label="Este mês"
              value={fmt$(d?.thisMonth.costUsd || 0, true)}
              sub={`${fmtK(d?.thisMonth.tokens || 0)} tokens`}
              warn={monthWarn}
            />
          </div>

          {/* Monthly limit gauge */}
          {limits.global?.monthlyUsd ? (
            <div className="card" style={{ padding: '14px 18px', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>Limite mensal</span>
                <span style={{ fontWeight: 600, color: monthWarn ? '#f97316' : 'var(--fg)' }}>
                  {fmt$(d?.thisMonth.costUsd || 0, true)} / {fmt$(limits.global.monthlyUsd, true)}
                  {' '}({pct(d?.thisMonth.costUsd || 0, limits.global.monthlyUsd).toFixed(0)}%)
                </span>
              </div>
              <GaugeBar used={d?.thisMonth.costUsd || 0} limit={limits.global.monthlyUsd} />
              {monthWarn && (
                <div style={{ fontSize: 11, color: '#f97316', marginTop: 6 }}>
                  ⚠️ Acima de 80% do limite mensal. Considere aumentar o limite ou pausar agentes.
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ padding: '12px 18px', marginBottom: 18, fontSize: 12, color: 'var(--muted)' }}>
              Nenhum limite de gasto configurado.{' '}
              <button className="ghost" style={{ fontSize: 12 }} onClick={() => setTab('limits')}>
                Configurar limite →
              </button>
            </div>
          )}

          {/* Daily limit gauge */}
          {limits.global?.dailyUsd && (
            <div className="card" style={{ padding: '14px 18px', marginBottom: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                <span style={{ color: 'var(--muted)' }}>Limite diário</span>
                <span style={{ fontWeight: 600 }}>
                  {fmt$(d?.today.costUsd || 0, true)} / {fmt$(limits.global.dailyUsd, true)}
                  {' '}({pct(d?.today.costUsd || 0, limits.global.dailyUsd).toFixed(0)}%)
                </span>
              </div>
              <GaugeBar used={d?.today.costUsd || 0} limit={limits.global.dailyUsd} />
            </div>
          )}

          {/* By agent breakdown */}
          {hasData && Object.keys(d!.byAgent).length > 0 && (
            <div className="card" style={{ padding: '14px 18px' }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12 }}>Por agente</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Object.entries(d!.byAgent)
                  .sort((a, b) => b[1].tokens - a[1].tokens)
                  .map(([id, ag]) => (
                    <div key={id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{ag.name}</span>
                        <span style={{ color: 'var(--muted)' }}>
                          {fmtK(ag.tokens)} tokens · {fmt$(ag.costUsd)} · {ag.calls} chamadas
                        </span>
                      </div>
                      <GaugeBar
                        used={ag.tokens}
                        limit={d!.totals.tokens}
                        color="#00bc8a"
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {!hasData && (
            <div className="card" style={{ textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum uso registrado ainda</p>
              <p style={{ fontSize: 12, color: 'var(--muted)' }}>
                O consumo de tokens aparece aqui conforme os agentes trabalham.
              </p>
            </div>
          )}
        </>
      )}

      {/* ── Log ── */}
      {tab === 'log' && (
        <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '130px 110px 110px 70px 70px 80px',
            gap: 0,
            padding: '4px 8px',
            borderBottom: '1px solid var(--border)',
            color: 'var(--muted)', fontSize: 10, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.05em',
            position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1,
          }}>
            <span>Agente</span>
            <span>Modelo</span>
            <span>Horário</span>
            <span style={{ textAlign: 'right' }}>Tokens</span>
            <span style={{ textAlign: 'right' }}>Custo</span>
            <span>Origem</span>
          </div>
          {(!d?.log?.length) ? (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>Nenhuma entrada ainda.</div>
          ) : (
            [...(d?.log || [])].reverse().map((e, i) => (
              <div key={i} style={{
                display: 'grid',
                gridTemplateColumns: '130px 110px 110px 70px 70px 80px',
                gap: 0,
                padding: '5px 8px',
                borderBottom: '1px solid var(--border)',
                color: 'var(--fg-2)',
              }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--primary)' }}>{e.agentName}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{e.model?.split('/').pop() || e.model}</span>
                <span style={{ color: 'var(--muted)' }}>{new Date(e.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                <span style={{ textAlign: 'right' }}>{fmtK(e.totalTokens)}</span>
                <span style={{ textAlign: 'right', color: e.costUsd > 0.01 ? '#f97316' : 'var(--fg-2)' }}>{fmt$(e.costUsd)}</span>
                <span style={{ color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.source || '—'}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Limits ── */}
      {tab === 'limits' && (
        <div style={{ maxWidth: 480 }}>
          <div className="card" style={{ padding: '18px 20px', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Limite Global de Gasto</div>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Quando o limite é atingido, as chamadas de IA são bloqueadas automaticamente.
              Deixe em branco para sem limite.
            </p>

            <div className="form-group">
              <label>Limite diário (USD)</label>
              <input
                type="number"
                min="0"
                step="0.5"
                placeholder="Ex: 1.00 (sem limite se vazio)"
                value={dailyUsd}
                onChange={e => setDailyUsd(e.target.value)}
              />
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                Bloqueia todos os agentes se o custo do dia ultrapassar este valor.
              </small>
            </div>

            <div className="form-group">
              <label>Limite mensal (USD)</label>
              <input
                type="number"
                min="0"
                step="1"
                placeholder="Ex: 10.00 (sem limite se vazio)"
                value={monthlyUsd}
                onChange={e => setMonthlyUsd(e.target.value)}
              />
              <small style={{ color: 'var(--muted)', fontSize: 11 }}>
                Bloqueia todos os agentes se o custo do mês ultrapassar este valor.
              </small>
            </div>

            <button onClick={saveLimits} disabled={saving} style={{ marginTop: 4 }}>
              {saving ? 'Salvando...' : saved ? '✅ Salvo!' : 'Salvar limites'}
            </button>
          </div>

          <div className="card" style={{ padding: '14px 18px' }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Referência de preços (estimativas)</div>
            <div style={{ fontSize: 11, color: '#00bc8a', marginBottom: 8 }}>
              Câmbio usado: 1 USD ≈ R${USD_BRL.toFixed(2)} — atualizado manualmente, pode variar.
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0 16px' }}>
                <span>GPT-4o</span><span>~$5.00 / 1M tokens</span>
                <span>GPT-4o-mini</span><span>~$0.15 / 1M tokens</span>
                <span>Claude 3.5 Sonnet</span><span>~$4.00 / 1M tokens</span>
                <span>Claude 3.5 Haiku</span><span>~$0.50 / 1M tokens</span>
                <span>Gemini 1.5 Flash</span><span>~$0.075 / 1M tokens</span>
                <span>DeepSeek Chat</span><span>~$0.14 / 1M tokens</span>
                <span>Llama / Gemma (free)</span><span>$0.00</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
