import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { MessageRenderer } from '../components/MessageRenderer';

interface Agent {
  id: string;
  name: string;
  role: string;
  adapter: string;
  model: string;
  status: string;
}

interface Message {
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
}

interface Thread {
  id: string;
  agentIds: string[];
  agentNames: string[];
  preview: string;
  updatedAt: string;
  messages: Message[];
}

const SUGGESTIONS = [
  'Resuma minha situação atual',
  'Quais tarefas estão pendentes?',
  'Crie um plano de ação para hoje',
  'Analise o desempenho dos agentes',
];

export function ChatPage() {
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Carrega agentes disponíveis
  useEffect(() => {
    api.get<Agent[]>('/enterprise/agents')
      .then(list => {
        const active = (list || []).filter(a => a.status === 'active');
        setAgents(active);
        // Se veio com agentId na URL, seleciona automaticamente
        if (agentId) {
          const a = active.find(ag => ag.id === agentId);
          if (a) setSelectedAgents([a]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAgents(false));
  }, [agentId]);

  // Carrega histórico quando agente selecionado
  useEffect(() => {
    if (selectedAgents.length === 1) {
      api.get<Message[]>(`/chat/${selectedAgents[0].id}/mensagens`)
        .then(msgs => {
          if (msgs && msgs.length > 0) setMessages(msgs);
        })
        .catch(() => {});
    }
  }, [selectedAgents]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function toggleAgent(agent: Agent) {
    setSelectedAgents(prev => {
      const has = prev.some(a => a.id === agent.id);
      return has ? prev.filter(a => a.id !== agent.id) : [...prev, agent];
    });
    setShowAgentPicker(false);
  }

  function removeAgent(id: string) {
    setSelectedAgents(prev => prev.filter(a => a.id !== id));
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    const userMsg: Message = {
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setSending(true);

    try {
      if (selectedAgents.length === 0) {
        // Sem agente — chat livre
        const res = await api.post<{ content: string }>('/chat/single', {
          message: content,
          adapter: 'openrouter',
          model: 'openrouter/auto',
        });
        setMessages(prev => [...prev, {
          role: 'agent',
          content: res.content || 'Sem resposta',
          timestamp: new Date().toISOString(),
          agentName: 'Assistente Geral',
        }]);

      } else if (selectedAgents.length === 1) {
        // Um agente
        const res = await api.post<{ content: string }>(`/chat/${selectedAgents[0].id}`, { message: content });
        setMessages(prev => [...prev, {
          role: 'agent',
          content: res.content || 'Sem resposta',
          timestamp: new Date().toISOString(),
          agentId: selectedAgents[0].id,
          agentName: selectedAgents[0].name,
        }]);

      } else {
        // Multi-agente — cada um responde em sequência
        for (const agent of selectedAgents) {
          setMessages(prev => [...prev, {
            role: 'system',
            content: `${agent.name} está pensando...`,
            timestamp: new Date().toISOString(),
          }]);

          const res = await api.post<{ content: string }>(`/chat/${agent.id}`, {
            message: content,
            context: messages.slice(-6), // contexto recente
          });

          setMessages(prev => {
            // Remove o "pensando..." e adiciona a resposta real
            const filtered = prev.filter(m => !(m.role === 'system' && m.content.includes(agent.name)));
            return [...filtered, {
              role: 'agent',
              content: res.content || 'Sem resposta',
              timestamp: new Date().toISOString(),
              agentId: agent.id,
              agentName: agent.name,
            }];
          });
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: 'system',
        content: `Erro: ${err.message || 'Falha ao enviar mensagem'}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
    }
  }

  function agentEmoji(agent: Agent) {
    const r = agent.role?.toLowerCase() || '';
    if (r.includes('ceo')) return '👔';
    if (r.includes('dev')) return '💻';
    if (r.includes('market')) return '📣';
    if (r.includes('support')) return '🎧';
    return '🤖';
  }

  function formatTime(iso: string) {
    try {
      return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  }

  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const userInitials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';

  return (
    <div className="chat-layout">
      {/* Painel de threads (lado esquerdo) */}
      <div className="chat-threads">
        <div className="chat-threads-header">
          <h3>Conversas</h3>
          <button
            className="icon-btn"
            title="Nova conversa"
            onClick={() => { setMessages([]); setSelectedAgents([]); navigate('/chat'); }}
          >
            +
          </button>
        </div>
        <div className="chat-threads-list">
          {loadingAgents ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>Carregando...</div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>
              Nenhum agente. <span style={{ color: '#c084fc', cursor: 'pointer' }} onClick={() => navigate('/agents')}>Contratar →</span>
            </div>
          ) : (
            <>
              {/* Chat geral */}
              <div
                className={`thread-item${selectedAgents.length === 0 && messages.length === 0 ? ' active' : ''}`}
                onClick={() => { setSelectedAgents([]); setMessages([]); navigate('/chat'); }}
              >
                <div className="thread-agents">
                  <div className="thread-agent-dot" style={{ background: 'linear-gradient(135deg,#9230F9,#00BC8A)' }}>✨</div>
                </div>
                <div className="thread-title">Assistente Geral</div>
                <div className="thread-preview">Chat sem agente específico</div>
              </div>

              <div style={{ height: 8 }} />

              {/* Agentes como "threads" */}
              {agents.map(agent => (
                <div
                  key={agent.id}
                  className={`thread-item${selectedAgents.some(a => a.id === agent.id) && selectedAgents.length === 1 ? ' active' : ''}`}
                  onClick={() => { setSelectedAgents([agent]); navigate(`/chat/${agent.id}`); }}
                >
                  <div className="thread-agents">
                    <div className="thread-agent-dot">{agentEmoji(agent)}</div>
                  </div>
                  <div className="thread-title">{agent.name}</div>
                  <div className="thread-preview">{agent.role}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Janela de chat */}
      <div className="chat-window">
        {/* Barra de agentes selecionados */}
        <div className="chat-agent-bar">
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Falando com:</span>

          {selectedAgents.length === 0 && (
            <span className="agent-chip" style={{ color: 'var(--muted)', background: 'transparent', border: '1px dashed var(--border-2)' }}>
              ✨ Assistente Geral
            </span>
          )}

          {selectedAgents.map(agent => (
            <span key={agent.id} className="agent-chip selected">
              {agentEmoji(agent)} {agent.name}
              <span
                className="agent-chip-remove"
                onClick={() => removeAgent(agent.id)}
                title="Remover"
              >×</span>
            </span>
          ))}

          {/* Botão adicionar agente */}
          <div style={{ position: 'relative' }}>
            <button
              className="add-agent-btn"
              onClick={() => setShowAgentPicker(p => !p)}
            >
              + agente
            </button>

            {showAgentPicker && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                background: 'var(--bg-3)',
                border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius)',
                padding: '6px',
                minWidth: 200,
                zIndex: 20,
                boxShadow: 'var(--shadow-md)',
              }}>
                {agents.length === 0 && (
                  <div style={{ padding: '8px 10px', color: 'var(--muted)', fontSize: 12 }}>
                    Nenhum agente disponível
                  </div>
                )}
                {agents.map(agent => {
                  const selected = selectedAgents.some(a => a.id === agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgent(agent)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        background: selected ? 'var(--primary-dim)' : 'transparent',
                        transition: 'background 0.1s',
                        fontSize: 13,
                        color: selected ? '#c084fc' : 'var(--fg-2)',
                      }}
                      onMouseOver={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-4)'; }}
                      onMouseOut={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <span>{agentEmoji(agent)}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{agent.role}</div>
                      </div>
                      {selected && <span style={{ marginLeft: 'auto', fontSize: 14 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedAgents.length > 1 && (
            <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>
              Multi-agente
            </span>
          )}
        </div>

        {/* Mensagens */}
        <div className="chat-messages" onClick={() => setShowAgentPicker(false)}>
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                {selectedAgents.length === 0 ? '✨' : selectedAgents.length === 1 ? agentEmoji(selectedAgents[0]) : '🤝'}
              </div>
              <h3>
                {selectedAgents.length === 0
                  ? 'Assistente Geral'
                  : selectedAgents.length === 1
                  ? selectedAgents[0].name
                  : `${selectedAgents.length} agentes selecionados`}
              </h3>
              <p>
                {selectedAgents.length === 0
                  ? 'Chat direto com IA. Sem agente específico, usando o modelo padrão.'
                  : selectedAgents.length === 1
                  ? `Converse com ${selectedAgents[0].name} — ${selectedAgents[0].role}`
                  : `Os agentes ${selectedAgents.map(a => a.name).join(', ')} vão responder em sequência.`}
              </p>
              <div className="chat-suggestion-chips">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => send(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => {
              if (msg.role === 'system') {
                return (
                  <div key={i} className="msg system" style={{ justifyContent: 'center' }}>
                    <div className="msg-bubble" style={{ maxWidth: '100%', textAlign: 'center' }}>
                      {msg.content}
                    </div>
                  </div>
                );
              }

              const isUser = msg.role === 'user';
              const agentForMsg = msg.agentId ? agents.find(a => a.id === msg.agentId) : null;

              return (
                <div key={i} className={`msg ${isUser ? 'user' : 'agent'}`}>
                  <div className="msg-avatar">
                    {isUser ? userInitials : (agentForMsg ? agentEmoji(agentForMsg) : '🤖')}
                  </div>
                  <div className="msg-body">
                    <div className="msg-meta">
                      <span className="msg-name">
                        {isUser ? (user?.name || 'Você') : (msg.agentName || 'Agente')}
                      </span>
                      <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    </div>
                    <div className="msg-bubble">
                      <MessageRenderer content={msg.content} />
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {sending && (
            <div className="msg agent">
              <div className="msg-avatar">🤖</div>
              <div className="msg-body">
                <div className="msg-thinking">
                  <div className="thinking-dot" />
                  <div className="thinking-dot" />
                  <div className="thinking-dot" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="chat-input-area">
          <div className="chat-input-box">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedAgents.length === 0
                  ? 'Mensagem para o Assistente Geral...'
                  : selectedAgents.length === 1
                  ? `Mensagem para ${selectedAgents[0].name}...`
                  : `Mensagem para ${selectedAgents.length} agentes...`
              }
              rows={1}
              disabled={sending}
            />
            <button
              className="chat-send-btn"
              onClick={() => send()}
              disabled={!input.trim() || sending}
              title="Enviar (Enter)"
            >
              ↑
            </button>
          </div>
          <div className="chat-input-hint">
            <span><kbd>Enter</kbd> envia · <kbd>Shift+Enter</kbd> quebra linha</span>
            {selectedAgents.length > 1 && (
              <span style={{ color: '#c084fc' }}>
                Multi-agente: {selectedAgents.map(a => a.name).join(' → ')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
