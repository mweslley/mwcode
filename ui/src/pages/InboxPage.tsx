import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface LogEntry { ts: string; msg: string; ok?: boolean; }

interface Issue {
  id: string;
  title: string;
  description: string;
  priority: string;
  approvalType?: 'contratar' | 'foco' | 'geral' | 'qa';
  assigneeAgentName?: string;
  createdByAgentName?: string;
  approvalStatus: 'pendente' | 'aprovado' | 'rejeitado';
  approvalNote?: string;
  hireData?: { name: string; role: string; instructions: string; model: string };
  focusData?: { mission?: string; goals?: string[] };
  logs?: LogEntry[];
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critico: '#ef4444', alto: '#f97316', medio: '#f59e0b', baixo: '#6b7280',
};

const APPROVAL_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  contratar: { label: 'Contratar Agente', icon: '🤝', color: 'rgba(124,58,237,0.15)' },
  foco:      { label: 'Mudança de Foco',  icon: '🎯', color: 'rgba(59,130,246,0.15)' },
  qa:        { label: 'Aprovação QA',     icon: '✅', color: 'rgba(16,185,129,0.15)' },
  geral:     { label: 'Solicitação',      icon: '🔔', color: 'rgba(245,158,11,0.15)' },
};

export function InboxPage() {
  const [items, setItems]   = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote]     = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  async function load() {
    setLoading(true);
    const list = await api.get<Issue[]>('/issues/inbox').catch(() => []);
    setItems(list || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    setActing(id);
    await api.post(`/issues/${id}/approve`, { note: note[id] || '' }).catch(() => {});
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedIssue(null);
    setActing(null);
  }

  async function reject(id: string) {
    setActing(id);
    await api.post(`/issues/${id}/reject`, { note: note[id] || '' }).catch(() => {});
    setItems(prev => prev.filter(i => i.id !== id));
    setSelectedIssue(null);
    setActing(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 className="page-title">📥 Caixa de Entrada</h1>
            <p className="page-subtitle">Solicitações do CEO e agentes que precisam da sua aprovação.</p>
          </div>
          <button className="ghost" onClick={load} style={{ fontSize: 12, padding: '6px 14px' }}>
            ↻ Atualizar
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>Carregando...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
          <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Caixa de entrada vazia</p>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Nenhuma solicitação pendente. O CEO age de forma autônoma quando não há aprovações pendentes.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const typeInfo = APPROVAL_TYPE_LABELS[item.approvalType || 'geral'] || APPROVAL_TYPE_LABELS.geral;

            return (
              <div key={item.id} className="card" style={{
                padding: '14px 18px',
                borderLeft: `3px solid ${PRIORITY_COLORS[item.priority] || '#6b7280'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{typeInfo.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Tipo + prioridade */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: typeInfo.color, color: 'var(--fg-2)',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {typeInfo.label}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                        background: `${PRIORITY_COLORS[item.priority] || '#6b7280'}22`,
                        color: PRIORITY_COLORS[item.priority] || '#6b7280',
                      }}>
                        {item.priority?.toUpperCase()}
                      </span>
                    </div>

                    {/* Título */}
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, lineHeight: 1.4 }}>
                      {item.title}
                    </div>

                    {/* Descrição resumida */}
                    {item.description && (
                      <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.55, marginBottom: 8 }}>
                        {item.description.slice(0, 140)}{item.description.length > 140 ? '…' : ''}
                      </div>
                    )}

                    {/* Meta */}
                    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                      {item.createdByAgentName && (
                        <span>👤 <strong style={{ color: 'var(--fg-2)' }}>{item.createdByAgentName}</strong></span>
                      )}
                      {item.assigneeAgentName && (
                        <span>→ <strong style={{ color: 'var(--fg-2)' }}>{item.assigneeAgentName}</strong></span>
                      )}
                      <span>🕐 {new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Botão detalhes */}
                  <button
                    onClick={() => setSelectedIssue(item)}
                    className="ghost"
                    style={{ fontSize: 11, padding: '4px 10px', flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    Ver detalhes →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de detalhes */}
      {selectedIssue && (() => {
        const item = selectedIssue;
        const typeInfo = APPROVAL_TYPE_LABELS[item.approvalType || 'geral'] || APPROVAL_TYPE_LABELS.geral;
        return (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={e => { if (e.target === e.currentTarget) setSelectedIssue(null); }}
          >
            <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 28, borderRadius: 14, borderLeft: `4px solid ${PRIORITY_COLORS[item.priority] || '#6b7280'}` }}>
              {/* Cabeçalho */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 20 }}>{typeInfo.icon}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: typeInfo.color, color: 'var(--fg-2)',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                      {typeInfo.label}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                      background: `${PRIORITY_COLORS[item.priority] || '#6b7280'}22`,
                      color: PRIORITY_COLORS[item.priority] || '#6b7280',
                    }}>
                      {item.priority?.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.3, marginBottom: 4 }}>{item.title}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', flexWrap: 'wrap' }}>
                    {item.createdByAgentName && (
                      <span>👤 <strong style={{ color: 'var(--fg-2)' }}>{item.createdByAgentName}</strong></span>
                    )}
                    {item.assigneeAgentName && (
                      <span>→ <strong style={{ color: 'var(--fg-2)' }}>{item.assigneeAgentName}</strong></span>
                    )}
                    <span>🕐 {new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <button className="ghost" onClick={() => setSelectedIssue(null)} style={{ fontSize: 22, padding: '2px 8px', lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>

              {/* Descrição completa */}
              {item.description && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Descrição</div>
                  <div style={{ fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.65, background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', whiteSpace: 'pre-wrap' }}>
                    {item.description}
                  </div>
                </div>
              )}

              {/* Dados de contratação */}
              {item.approvalType === 'contratar' && item.hireData && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Dados do Agente a Contratar
                  </div>
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 13 }}><strong>Nome:</strong> {item.hireData.name}</div>
                    <div style={{ fontSize: 13 }}><strong>Função:</strong> {item.hireData.role}</div>
                    {item.hireData.instructions && (
                      <div style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                        <strong>Instruções:</strong><br />{item.hireData.instructions}
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>Modelo: {item.hireData.model}</div>
                  </div>
                </div>
              )}

              {/* Dados de foco */}
              {item.approvalType === 'foco' && item.focusData && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Nova Estratégia de Foco
                  </div>
                  <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                    {item.focusData.mission && (
                      <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Missão:</strong> {item.focusData.mission}</div>
                    )}
                    {item.focusData.goals && item.focusData.goals.length > 0 && (
                      <div style={{ fontSize: 13 }}>
                        <strong>Objetivos:</strong>
                        <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {item.focusData.goals.map((g, i) => (
                            <li key={i} style={{ fontSize: 12, color: 'var(--fg-2)', marginBottom: 2 }}>{g}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Log de ações */}
              {item.logs && item.logs.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                    Histórico ({item.logs.length} eventos)
                  </div>
                  <div style={{
                    background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px',
                    maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4,
                  }}>
                    {item.logs.map((log, i) => (
                      <div key={i} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                        <span style={{ color: 'var(--muted)', flexShrink: 0, fontFamily: 'monospace' }}>
                          {new Date(log.ts).toLocaleTimeString('pt-BR')}
                        </span>
                        <span style={{ color: log.ok === false ? '#ef4444' : 'var(--fg-2)', lineHeight: 1.45 }}>
                          {log.msg}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="Nota (opcional)..."
                  value={note[item.id] || ''}
                  onChange={e => setNote(n => ({ ...n, [item.id]: e.target.value }))}
                  style={{ fontSize: 12, padding: '7px 10px', flex: 1, minWidth: 160 }}
                />
                <button
                  onClick={() => approve(item.id)}
                  disabled={acting === item.id}
                  style={{
                    fontSize: 13, padding: '8px 20px', fontWeight: 700,
                    background: 'rgba(16,185,129,0.15)',
                    border: '1px solid rgba(16,185,129,0.4)',
                    color: '#10b981', borderRadius: 8,
                  }}
                >
                  {acting === item.id ? '...' : '✓ Aprovar'}
                </button>
                <button
                  onClick={() => reject(item.id)}
                  disabled={acting === item.id}
                  className="ghost"
                  style={{ fontSize: 13, padding: '8px 18px', color: 'var(--danger)', borderRadius: 8 }}
                >
                  ✕ Rejeitar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
