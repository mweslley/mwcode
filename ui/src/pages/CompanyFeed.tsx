import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function getDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateLabel(key: string): string {
  const today = getDateKey(new Date().toISOString());
  const yesterday = getDateKey(new Date(Date.now() - 86400000).toISOString());
  if (key === today) return 'Hoje';
  if (key === yesterday) return 'Ontem';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

function getHourKey(iso: string): string {
  const d = new Date(iso);
  return String(d.getHours()).padStart(2, '0') + 'h';
}

function truncate(text: string, max = 300): string {
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function CompanyFeed() {
  const navigate = useNavigate();
  const MAX_MESSAGES = 300;
  const [messages, setMessages] = useState<FeedMessage[]>([]);
  const [trimmedCount, setTrimmedCount] = useState(0);
  const [agents, setAgents] = useState<FeedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const [filterAgent, setFilterAgent] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newCount, setNewCount] = useState(0);
  const [selectedDate, setSelectedDate] = useState<string>(''); // '' = hoje
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
      const url = initial ? '/feed?limit=100' : `/feed${since}`;
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
        setMessages(prev => {
          const combined = [...prev, ...newMsgs];
          if (combined.length > MAX_MESSAGES) {
            const trimmed = combined.length - MAX_MESSAGES;
            setTrimmedCount(c => c + trimmed);
            return combined.slice(combined.length - MAX_MESSAGES);
          }
          return combined;
        });
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
    if (isAtBottom.current && !selectedDate) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewCount(0);
    }
  }, [messages, selectedDate]);

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

  const agentFiltered = filterAgent === 'all' ? messages : messages.filter(m => m.agentId === filterAgent);

  const availableDates = useMemo(() => {
    const dateSet = new Set<string>();
    agentFiltered.forEach(m => dateSet.add(getDateKey(m.timestamp)));
    return Array.from(dateSet).sort((a, b) => b.localeCompare(a));
  }, [agentFiltered]);

  const todayKey = getDateKey(new Date().toISOString());
  const activeDateKey = selectedDate || todayKey;

  const dateFiltered = useMemo(
    () => agentFiltered.filter(m => getDateKey(m.timestamp) === activeDateKey),
    [agentFiltered, activeDateKey]
  );

  // Agrupa por hora
  const grouped = useMemo(() => {
    const groups: { hour: string; msgs: FeedMessage[] }[] = [];
    dateFiltered.forEach(msg => {
      const h = getHourKey(msg.timestamp);
      const last = groups[groups.length - 1];
      if (last && last.hour === h) {
        last.msgs.push(msg);
      } else {
        groups.push({ hour: h, msgs: [msg] });
      }
    });
    return groups;
  }, [dateFiltered]);

  const currentIdx = availableDates.indexOf(activeDateKey);
  const hasPrev = currentIdx < availableDates.length - 1;
  const hasNext = currentIdx > 0;

  function goToDate(key: string) {
    setSelectedDate(key === todayKey ? '' : key);
    isAtBottom.current = false;
    setTimeout(() => listRef.current?.scrollTo({ top: 0 }), 50);
  }

  const displayDates = availableDates.length > 0 ? availableDates : [todayKey];

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
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="ghost"
              style={{ fontSize: 11, padding: '4px 10px', color: 'var(--muted)' }}
              onClick={() => { setMessages([]); setTrimmedCount(0); setNewCount(0); loadFeed(true); }}
            >
              🗑 Limpar
            </button>
            <button
              className={live ? '' : 'ghost'}
              style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={() => setLive(l => !l)}
            >
              {live ? '⏸ Pausar' : '▶ Retomar'}
            </button>
          </div>
        </div>
      </div>

      {/* Navegação de datas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexShrink: 0 }}>
        <button
          className="ghost"
          disabled={!hasPrev}
          onClick={() => hasPrev && goToDate(availableDates[currentIdx + 1])}
          style={{ fontSize: 11, padding: '4px 8px', opacity: hasPrev ? 1 : 0.3, flexShrink: 0 }}
        >
          ←
        </button>
        <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
          {displayDates.slice(0, 7).map(d => (
            <button
              key={d}
              onClick={() => goToDate(d)}
              style={{
                fontSize: 11, padding: '4px 12px', borderRadius: 20,
                background: activeDateKey === d ? 'var(--primary)' : 'var(--bg-2)',
                color: activeDateKey === d ? '#fff' : 'var(--fg-2)',
                borderColor: activeDateKey === d ? 'var(--primary)' : 'var(--border)',
              }}
            >
              {getDateLabel(d)}
            </button>
          ))}
        </div>
        <button
          className="ghost"
          disabled={!hasNext}
          onClick={() => hasNext && goToDate(availableDates[currentIdx - 1])}
          style={{ fontSize: 11, padding: '4px 8px', opacity: hasNext ? 1 : 0.3, flexShrink: 0 }}
        >
          →
        </button>
      </div>

      {/* Filtros de agente */}
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

      {/* Feed */}
      <div
        ref={listRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', position: 'relative' }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>
            Carregando...
          </div>
        ) : dateFiltered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
            {messages.length === 0 ? (
              <>
                <p style={{ fontWeight: 600, marginBottom: 6 }}>Nenhuma atividade ainda</p>
                <p style={{ fontSize: 12, marginBottom: 16 }}>
                  Quando seus agentes agirem, tudo aparece aqui em tempo real.
                </p>
                <button onClick={() => navigate('/agents')} style={{ fontSize: 12 }}>Ir para Agentes</button>
              </>
            ) : (
              <p style={{ fontSize: 13 }}>Nenhuma mensagem em {getDateLabel(activeDateKey)}.</p>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 16 }}>
            {trimmedCount > 0 && (
              <div style={{ padding: '5px 12px', fontSize: 11, color: 'var(--muted)', background: 'var(--bg-2)', borderBottom: '1px solid var(--border)', textAlign: 'center', marginBottom: 8 }}>
                {trimmedCount} mensagem{trimmedCount > 1 ? 's antigas ocultadas' : ' antiga ocultada'} — exibindo as {MAX_MESSAGES} mais recentes
              </div>
            )}

            {grouped.map(({ hour, msgs }, gi) => (
              <div key={gi}>
                {/* Separador de hora */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '14px 0 8px' }}>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                  <span style={{
                    fontSize: 10, color: 'var(--muted)', fontWeight: 600,
                    letterSpacing: '0.06em', whiteSpace: 'nowrap',
                    padding: '2px 8px', background: 'var(--bg-2)',
                    border: '1px solid var(--border)', borderRadius: 20,
                  }}>
                    {hour}
                  </span>
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {msgs.map(msg => {
                  const isUser = msg.role === 'user';
                  const isSystem = msg.role === 'system';
                  const isExp = expanded.has(msg.id);
                  const needsExpand = msg.content.length > 300;

                  if (isSystem) {
                    return (
                      <div key={msg.id} style={{ textAlign: 'center', margin: '4px 0' }}>
                        <span style={{
                          fontSize: 11, color: 'var(--muted)',
                          background: 'var(--bg-2)', padding: '2px 10px',
                          borderRadius: 20, border: '1px solid var(--border)',
                        }}>
                          {msg.content}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      style={{
                        display: 'flex', gap: 10, padding: '4px 2px',
                        alignItems: 'flex-start',
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: isUser ? 'rgba(0,188,138,0.12)' : 'rgba(146,48,249,0.12)',
                        border: `1px solid ${isUser ? 'rgba(0,188,138,0.3)' : 'rgba(146,48,249,0.25)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, marginTop: 2,
                      }}>
                        {isUser ? '👤' : msg.agentEmoji}
                      </div>

                      {/* Conteúdo */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                          <span
                            style={{
                              fontWeight: 700, fontSize: 13,
                              color: isUser ? '#00bc8a' : 'var(--primary)',
                              cursor: isUser ? 'default' : 'pointer',
                            }}
                            onClick={() => !isUser && navigate(`/chat/${msg.agentId}`)}
                            title={msg.agentRole || (isUser ? 'Você' : msg.agentName)}
                          >
                            {isUser ? 'Você' : msg.agentName}
                          </span>
                          {!isUser && msg.agentRole && (
                            <span style={{ fontSize: 10, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                              {msg.agentRole}
                            </span>
                          )}
                          <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 'auto', flexShrink: 0 }}>
                            {formatTime(msg.timestamp)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6,
                          wordBreak: 'break-word',
                          background: 'var(--bg-2)',
                          border: '1px solid var(--border)',
                          borderRadius: isUser ? '10px 10px 10px 2px' : '2px 10px 10px 10px',
                          padding: '8px 12px',
                          whiteSpace: isExp ? 'pre-wrap' : 'normal',
                        }}>
                          {isExp ? msg.content : truncate(msg.content)}
                          {needsExpand && (
                            <button
                              onClick={() => toggleExpand(msg.id)}
                              style={{
                                display: 'block', marginTop: 6, fontSize: 11, padding: '2px 10px',
                                background: 'var(--bg-3)', border: '1px solid var(--border)',
                                color: 'var(--muted)', cursor: 'pointer', borderRadius: 4,
                              }}
                            >
                              {isExp ? '▲ mostrar menos' : '▼ ver completo'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
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
