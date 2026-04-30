import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

interface FeedMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  agentEmoji: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

interface FeedAgent {
  id: string;
  name: string;
  role: string;
  emoji: string;
  messageCount: number;
  lastActivity: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function CompanyFeed() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [agents, setAgents] = useState<FeedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [lastCheck, setLastCheck] = useState<Date>(new Date());
  const [newCount, setNewCount] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const latestTimestamp = useRef<string>('');
  const isAtBottom = useRef(true);

  const company = (() => { try { return JSON.parse(localStorage.getItem('company') || '{}'); } catch { return {}; } })();

  const loadAgents = useCallback(async () => {
    try {
      const list = await api.get<FeedAgent[]>('/feed/agents');
      setAgents(list || []);
    } catch {}
  }, []);

  const loadFeed = useCallback(async (initial = false) => {
    try {
      const since = initial ? '' : `?since=${encodeURIComponent(latestTimestamp.current)}&limit=50`;
      const url = initial ? '/feed?limit=150' : `/feed${since}`;
      const data = await api.get<FeedMessage[]>(url);
      if (!data?.length) return;

      if (initial) {
        // Inverte para ordem cronológica (mais antigo primeiro)
        const sorted = [...data].reverse();
        setMessages(sorted);
        latestTimestamp.current = data[0]?.timestamp || '';
        setLoading(false);
      } else {
        const newMsgs = data.reverse(); // newest-first → oldest-first
        if (!newMsgs.length) return;
        latestTimestamp.current = data[data.length - 1]?.timestamp || latestTimestamp.current;
        setMessages(prev => [...prev, ...newMsgs]);
        setNewCount(n => n + newMsgs.length);
        setLastCheck(new Date());
      }
    } catch {
      if (initial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed(true);
    loadAgents();
  }, [loadFeed, loadAgents]);

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => loadFeed(false), 3000);
    return () => clearInterval(id);
  }, [live, loadFeed]);

  // Auto-scroll to bottom when new messages arrive if user is already at bottom
  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    }
  }, [messages]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    isAtBottom.current = atBottom;
    if (atBottom) setNewCount(0);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewCount(0);
  }

  const filtered = filterAgent === 'all'
    ? messages
    : messages.filter(m => m.agentId === filterAgent);

  // Group consecutive messages by same agent+role into bursts
  const grouped: Array<{ key: string; msgs: FeedMessage[] }> = [];
  for (const msg of filtered) {
    const last = grouped[grouped.length - 1];
    if (last && last.msgs[0].agentId === msg.agentId && last.msgs[0].role === msg.role) {
      last.msgs.push(msg);
    } else {
      grouped.push({ key: msg.id, msgs: [msg] });
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              Atividade ao Vivo
              {live && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 11, fontWeight: 500, color: '#10b981',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  padding: '2px 8px', borderRadius: 20,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite' }} />
                  AO VIVO
                </span>
              )}
            </h1>
            <p className="page-subtitle">
              {company?.name ? `${company.name} — ` : ''}Todas as conversas da sua equipe de IA em tempo real
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Atualizado {lastCheck.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              className={live ? '' : 'ghost'}
              style={{ fontSize: 12, padding: '5px 12px' }}
              onClick={() => setLive(l => !l)}
            >
              {live ? '⏸ Pausar' : '▶ Retomar'}
            </button>
          </div>
        </div>
      </div>

      {/* Agent filter chips */}
      {agents.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, flexShrink: 0 }}>
          <button
            onClick={() => setFilterAgent('all')}
            style={{
              fontSize: 12, padding: '5px 13px',
              background: filterAgent === 'all' ? 'var(--primary)' : 'var(--bg-2)',
              color: filterAgent === 'all' ? '#fff' : 'var(--fg-2)',
              borderColor: filterAgent === 'all' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            🌐 Todos ({messages.length})
          </button>
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => setFilterAgent(a.id)}
              style={{
                fontSize: 12, padding: '5px 13px',
                background: filterAgent === a.id ? 'var(--primary)' : 'var(--bg-2)',
                color: filterAgent === a.id ? '#fff' : 'var(--fg-2)',
                borderColor: filterAgent === a.id ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {a.emoji} {a.name} ({a.messageCount})
            </button>
          ))}
        </div>
      )}

      {/* Feed container */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          paddingRight: 4,
          position: 'relative',
        }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <p>Carregando feed da empresa...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
            <h3 style={{ marginBottom: 8 }}>Nenhuma atividade ainda</h3>
            <p style={{ fontSize: 13, marginBottom: 20 }}>
              Quando seus agentes trocarem mensagens, tudo aparece aqui em tempo real.
            </p>
            <button onClick={() => navigate('/agents')}>🤖 Ir para Agentes</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 24 }}>
            {grouped.map(group => {
              const first = group.msgs[0];
              const isAgent = first.role === 'agent';
              const isUser = first.role === 'user';

              return (
                <div
                  key={group.key}
                  style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    gap: 10,
                    padding: '6px 4px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Avatar */}
                  {isAgent && (
                    <div
                      onClick={() => navigate(`/chat/${first.agentId}`)}
                      title={`Ver conversa com ${first.agentName}`}
                      style={{
                        width: 36, height: 36, flexShrink: 0, borderRadius: '50%',
                        background: 'var(--primary-dim)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 18, cursor: 'pointer',
                        marginTop: 2,
                      }}
                    >
                      {first.agentEmoji}
                    </div>
                  )}

                  <div style={{ flex: 1, minWidth: 0, maxWidth: isUser ? '72%' : '80%' }}>
                    {/* Nome + horário */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      marginBottom: 4,
                      flexDirection: isUser ? 'row-reverse' : 'row',
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: isAgent ? 'var(--primary)' : 'var(--secondary)' }}>
                        {isAgent ? first.agentName : 'Você'}
                      </span>
                      {first.agentRole && isAgent && (
                        <span style={{ fontSize: 10, color: 'var(--muted)' }}>{first.agentRole}</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto' }}>
                        {formatTime(first.timestamp)}
                      </span>
                    </div>

                    {/* Mensagens do grupo */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {group.msgs.map((msg, i) => (
                        <div
                          key={msg.id}
                          style={{
                            background: isUser
                              ? 'rgba(0,188,138,0.12)'
                              : isAgent
                              ? 'var(--bg-2)'
                              : 'var(--bg-3)',
                            border: `1px solid ${isUser ? 'rgba(0,188,138,0.25)' : 'var(--border)'}`,
                            borderRadius: i === 0
                              ? isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px'
                              : 8,
                            padding: '8px 12px',
                            fontSize: 13,
                            color: 'var(--fg)',
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                          }}
                        >
                          {msg.content}
                        </div>
                      ))}
                    </div>

                    {/* Tempo relativo da última mensagem do grupo */}
                    <div style={{
                      fontSize: 10,
                      color: 'var(--muted)',
                      marginTop: 3,
                      textAlign: isUser ? 'right' : 'left',
                    }}>
                      {timeAgo(group.msgs[group.msgs.length - 1].timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Badge de novas mensagens (quando não está no bottom) */}
      {newCount > 0 && (
        <div
          onClick={scrollToBottom}
          style={{
            position: 'fixed',
            bottom: 32,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--primary)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(146,48,249,0.4)',
            zIndex: 10,
          }}
        >
          ↓ {newCount} nova{newCount > 1 ? 's mensagens' : ' mensagem'}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
