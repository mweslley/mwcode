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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function truncate(text: string, max = 120): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function CompanyFeed() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [agents, setAgents] = useState<FeedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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
      const url = initial ? '/feed?limit=200' : `/feed${since}`;
      const data = await api.get<FeedMessage[]>(url);
      if (!data?.length) {
        if (initial) setLoading(false);
        return;
      }

      if (initial) {
        const sorted = [...data].reverse();
        setMessages(sorted);
        latestTimestamp.current = data[0]?.timestamp || '';
        setLoading(false);
      } else {
        const newMsgs = data.reverse();
        if (!newMsgs.length) return;
        latestTimestamp.current = data[data.length - 1]?.timestamp || latestTimestamp.current;
        setMessages(prev => [...prev, ...newMsgs]);
        if (!isAtBottom.current) setNewCount(n => n + newMsgs.length);
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

  useEffect(() => {
    if (isAtBottom.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    }
  }, [messages]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    isAtBottom.current = atBottom;
    if (atBottom) setNewCount(0);
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewCount(0);
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = filterAgent === 'all'
    ? messages
    : messages.filter(m => m.agentId === filterAgent);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: '100vh' }}>
      {/* Header */}
      <div className="page-header" style={{ flexShrink: 0, paddingBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
              Atividade ao Vivo
              {live && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 600, color: '#10b981',
                  background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                  padding: '2px 7px', borderRadius: 20,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'pulse 1.5s infinite', display: 'inline-block' }} />
                  AO VIVO
                </span>
              )}
            </h1>
            {company?.name && (
              <p className="page-subtitle" style={{ fontSize: 11, marginTop: 2 }}>
                {company.name}
              </p>
            )}
          </div>
          <button
            className={live ? '' : 'ghost'}
            style={{ fontSize: 11, padding: '4px 10px' }}
            onClick={() => setLive(l => !l)}
          >
            {live ? '⏸ Pausar' : '▶ Retomar'}
          </button>
        </div>
      </div>

      {/* Agent filter chips */}
      {agents.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10, flexShrink: 0 }}>
          <button
            onClick={() => setFilterAgent('all')}
            style={{
              fontSize: 11, padding: '3px 10px',
              background: filterAgent === 'all' ? 'var(--primary)' : 'var(--bg-2)',
              color: filterAgent === 'all' ? '#fff' : 'var(--fg-2)',
              borderColor: filterAgent === 'all' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            Todos ({messages.length})
          </button>
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => setFilterAgent(a.id)}
              style={{
                fontSize: 11, padding: '3px 10px',
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

      {/* Log table */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
            Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma atividade ainda</p>
            <p style={{ fontSize: 12, marginBottom: 16 }}>
              Quando seus agentes agirem, tudo aparece aqui em tempo real.
            </p>
            <button onClick={() => navigate('/agents')} style={{ fontSize: 12 }}>Ir para Agentes</button>
          </div>
        ) : (
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}>
            {/* Column header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '72px 130px 1fr',
              gap: 0,
              padding: '4px 8px',
              borderBottom: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              position: 'sticky', top: 0,
              background: 'var(--bg)',
              zIndex: 1,
            }}>
              <span>Horário</span>
              <span>Agente</span>
              <span>Mensagem</span>
            </div>

            {filtered.map(msg => {
              const isUser = msg.role === 'user';
              const isExp = expanded.has(msg.id);
              const needsExpand = msg.content.length > 120;

              return (
                <div
                  key={msg.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '72px 130px 1fr',
                    gap: 0,
                    padding: '5px 8px',
                    borderBottom: '1px solid var(--border)',
                    alignItems: 'baseline',
                    background: isUser ? 'rgba(0,188,138,0.04)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = isUser ? 'rgba(0,188,138,0.08)' : 'var(--bg-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = isUser ? 'rgba(0,188,138,0.04)' : 'transparent')}
                >
                  {/* Time */}
                  <span style={{ color: 'var(--muted)', fontSize: 11, whiteSpace: 'nowrap', userSelect: 'none' }}>
                    {formatTime(msg.timestamp)}
                  </span>

                  {/* Agent */}
                  <span
                    onClick={() => !isUser && navigate(`/chat/${msg.agentId}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      color: isUser ? '#00bc8a' : 'var(--primary)',
                      fontWeight: 600,
                      cursor: isUser ? 'default' : 'pointer',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                    }}
                    title={msg.agentRole || (isUser ? 'Você' : msg.agentName)}
                  >
                    <span style={{ fontSize: 13 }}>{isUser ? '👤' : msg.agentEmoji}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {isUser ? 'Você' : msg.agentName}
                    </span>
                  </span>

                  {/* Content */}
                  <span
                    style={{
                      color: 'var(--fg-2)',
                      lineHeight: 1.45,
                      wordBreak: 'break-word',
                      whiteSpace: isExp ? 'pre-wrap' : 'nowrap',
                      overflow: isExp ? 'visible' : 'hidden',
                      textOverflow: isExp ? 'unset' : 'ellipsis',
                    }}
                  >
                    {isExp ? msg.content : truncate(msg.content)}
                    {needsExpand && (
                      <button
                        onClick={() => toggleExpand(msg.id)}
                        style={{
                          marginLeft: 6, fontSize: 10, padding: '1px 6px',
                          background: 'var(--bg-3)', border: '1px solid var(--border)',
                          color: 'var(--muted)', cursor: 'pointer', borderRadius: 4,
                          verticalAlign: 'middle',
                        }}
                      >
                        {isExp ? '▲ menos' : '▼ mais'}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} style={{ height: 16 }} />
          </div>
        )}
      </div>

      {/* Badge de novas mensagens */}
      {newCount > 0 && (
        <div
          onClick={scrollToBottom}
          style={{
            position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--primary)', color: '#fff',
            padding: '6px 18px', borderRadius: 20,
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(146,48,249,0.4)', zIndex: 10,
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
