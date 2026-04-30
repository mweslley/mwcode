import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Issue {
  id: string;
  title: string;
  description: string;
  priority: string;
  assigneeAgentName?: string;
  createdByAgentName?: string;
  approvalStatus: 'pendente' | 'aprovado' | 'rejeitado';
  approvalNote?: string;
  createdAt: string;
}

const PRIORITY_COLORS: Record<string, string> = {
  critico: '#ef4444', alto: '#f97316', medio: '#f59e0b', baixo: '#6b7280',
};

export function InboxPage() {
  const [items, setItems] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    const list = await api.get<Issue[]>('/issues/inbox').catch(() => []);
    setItems(list || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(id: string) {
    setActing(id);
    await api.post(`/issues/${id}/approve`, { note: note[id] || '' }).catch(() => {});
    setItems(prev => prev.filter(i => i.id !== id));
    setActing(null);
  }

  async function reject(id: string) {
    setActing(id);
    await api.post(`/issues/${id}/reject`, { note: note[id] || '' }).catch(() => {});
    setItems(prev => prev.filter(i => i.id !== id));
    setActing(null);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Solicitações dos agentes que precisam da sua aprovação.</p>
      </div>

      {loading ? (
        <div style={{ color: 'var(--muted)', padding: 24, textAlign: 'center' }}>Carregando...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📥</div>
          <p style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Inbox vazio</p>
          <p style={{ color: 'var(--muted)', fontSize: 13 }}>
            Nenhuma solicitação pendente dos seus agentes.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{
              padding: '16px 18px',
              borderLeft: `3px solid ${PRIORITY_COLORS[item.priority] || '#6b7280'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ fontSize: 24, flexShrink: 0 }}>🔔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.title}</div>
                  {item.description && (
                    <div style={{ fontSize: 13, color: 'var(--fg-2)', marginBottom: 8 }}>
                      {item.description}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--muted)', marginBottom: 12, flexWrap: 'wrap' }}>
                    {item.createdByAgentName && (
                      <span>👤 Solicitado por <strong style={{ color: 'var(--fg-2)' }}>{item.createdByAgentName}</strong></span>
                    )}
                    {item.assigneeAgentName && (
                      <span>→ Atribuído a <strong style={{ color: 'var(--fg-2)' }}>{item.assigneeAgentName}</strong></span>
                    )}
                    <span>🕐 {new Date(item.createdAt).toLocaleString('pt-BR')}</span>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <input
                      placeholder="Nota (opcional)..."
                      value={note[item.id] || ''}
                      onChange={e => setNote(n => ({ ...n, [item.id]: e.target.value }))}
                      style={{ fontSize: 12, padding: '6px 10px', width: '100%', maxWidth: 400 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => approve(item.id)}
                      disabled={acting === item.id}
                      style={{
                        fontSize: 12, padding: '6px 16px',
                        background: 'rgba(16,185,129,0.15)',
                        border: '1px solid rgba(16,185,129,0.4)',
                        color: '#10b981',
                      }}
                    >
                      {acting === item.id ? '...' : '✓ Aprovar'}
                    </button>
                    <button
                      onClick={() => reject(item.id)}
                      disabled={acting === item.id}
                      className="ghost"
                      style={{ fontSize: 12, padding: '6px 16px', color: 'var(--danger)' }}
                    >
                      ✕ Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
