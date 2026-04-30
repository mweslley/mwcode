import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { MessageRenderer } from '../components/MessageRenderer';

interface Agent {
  id: string;
  name: string;
  role: string;
  adapter?: string;
  provider?: string;
  model: string;
  status: string;
}

interface Message {
  id?: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  agentId?: string;
  agentName?: string;
  model?: string;
  needsApproval?: boolean;
}

const SUGGESTIONS = [
  'Resuma minha situação atual',
  'Quais tarefas estão pendentes?',
  'Crie um plano de ação para hoje',
  'Analise o desempenho dos agentes',
];

function agentEmoji(role: string) {
  const r = (role || '').toLowerCase();
  if (r.includes('ceo')) return '👔';
  if (r.includes('dev') || r.includes('código')) return '💻';
  if (r.includes('market') || r.includes('copy')) return '📣';
  if (r.includes('support') || r.includes('suporte')) return '🎧';
  if (r.includes('design')) return '🎨';
  if (r.includes('data') || r.includes('dados')) return '📊';
  return '🤖';
}

function formatTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

function modelShort(m?: string) {
  if (!m) return null;
  return m.split('/').pop()?.split(':')[0] ?? m;
}

// Detecta se a mensagem pede aprovação do humano
function needsApproval(content: string) {
  return content.includes('[APROVAÇÃO NECESSÁRIA]') || content.includes('[APPROVAL NEEDED]');
}

export function ChatPage() {
  const { agentId } = useParams<{ agentId?: string }>();
  const navigate = useNavigate();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [pendingAbort, setPendingAbort] = useState(false);
  const [deletingThread, setDeletingThread] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: '', description: '', priority: 'medio' });
  const [savingTask, setSavingTask] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  // Load agents
  useEffect(() => {
    api.get<Agent[]>('/enterprise/agents')
      .then(list => {
        // Dedup: mantém só o primeiro por nome+role (igual AgentsPage)
        const seen = new Set<string>();
        const active = (list || []).filter(a => a.status === 'active').filter(a => {
          const key = `${a.name.trim().toLowerCase()}::${(a.role || '').trim().toLowerCase()}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setAgents(active);
        if (agentId) {
          const a = active.find(ag => ag.id === agentId);
          if (a) setSelectedAgents([a]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingAgents(false));
  }, [agentId]);

  // Load history when agentId changes (URL-based)
  useEffect(() => {
    if (!agentId) { setMessages([]); return; }
    setLoadingHistory(true);
    api.get<Message[]>(`/chat/${agentId}`)
      .then(msgs => {
        if (msgs && msgs.length > 0) setMessages(msgs);
        else setMessages([]);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [agentId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function toggleAgent(agent: Agent) {
    setSelectedAgents(prev => {
      const has = prev.some(a => a.id === agent.id);
      const next = has ? prev.filter(a => a.id !== agent.id) : [...prev, agent];
      if (!has && next.length === 1) {
        navigate(`/chat/${agent.id}`);
      }
      return next;
    });
    setShowAgentPicker(false);
  }

  function removeAgent(id: string) {
    setSelectedAgents(prev => prev.filter(a => a.id !== id));
  }

  function cancelSend() {
    abortRef.current = true;
    setPendingAbort(true);
    setSending(false);
    // Remove last user message if no response yet
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'user') return prev.slice(0, -1);
      return prev;
    });
    setTimeout(() => { abortRef.current = false; setPendingAbort(false); }, 500);
  }

  async function deleteMessage(idx: number) {
    setMessages(prev => prev.filter((_, i) => i !== idx));
  }

  async function approveAction(msg: Message, approve: boolean) {
    const response = approve
      ? `Aprovado. Pode prosseguir com a ação.`
      : `Ação cancelada. Por favor, proponha uma alternativa.`;
    await send(response);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    abortRef.current = false;

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
        if (abortRef.current) return;
        const res = await api.post<{ content: string; model?: string }>('/chat/single', {
          message: content,
        });
        if (!abortRef.current) {
          setMessages(prev => [...prev, {
            role: 'agent',
            content: res.content || 'Sem resposta',
            model: res.model,
            timestamp: new Date().toISOString(),
            agentName: 'Assistente Geral',
            needsApproval: needsApproval(res.content || ''),
          }]);
        }
      } else if (selectedAgents.length === 1) {
        if (abortRef.current) return;
        const res = await api.post<{ content: string; model?: string }>(`/chat/${selectedAgents[0].id}`, { message: content });
        if (!abortRef.current) {
          setMessages(prev => [...prev, {
            role: 'agent',
            content: res.content || 'Sem resposta',
            model: res.model,
            timestamp: new Date().toISOString(),
            agentId: selectedAgents[0].id,
            agentName: selectedAgents[0].name,
            needsApproval: needsApproval(res.content || ''),
          }]);
        }
      } else {
        // Multi-agent
        for (const agent of selectedAgents) {
          if (abortRef.current) break;
          setMessages(prev => [...prev, {
            role: 'system',
            content: `${agent.name} está pensando...`,
            timestamp: new Date().toISOString(),
          }]);

          const res = await api.post<{ content: string; model?: string }>(`/chat/${agent.id}`, { message: content });

          if (!abortRef.current) {
            setMessages(prev => {
              const filtered = prev.filter(m => !(m.role === 'system' && m.content.includes(agent.name)));
              return [...filtered, {
                role: 'agent',
                content: res.content || 'Sem resposta',
                model: res.model,
                timestamp: new Date().toISOString(),
                agentId: agent.id,
                agentName: agent.name,
                needsApproval: needsApproval(res.content || ''),
              }];
            });
          }
        }
      }
    } catch (err: any) {
      if (!abortRef.current) {
        setMessages(prev => [...prev, {
          role: 'system',
          content: `❌ Erro: ${err.message || 'Falha ao enviar mensagem'}`,
          timestamp: new Date().toISOString(),
        }]);
      }
    } finally {
      setSending(false);
      abortRef.current = false;
      window.dispatchEvent(new Event('mwcode:chat-updated'));
    }
  }

  async function deleteThread(threadAgentId: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Apagar todo o histórico desta conversa? Isso não remove o agente.')) return;
    setDeletingThread(threadAgentId);
    try {
      await api.delete(`/chat/${threadAgentId}`);
      if (threadAgentId === agentId) setMessages([]);
      showToast('✓ Histórico apagado');
      window.dispatchEvent(new Event('mwcode:chat-updated'));
    } catch {
      showToast('❌ Erro ao apagar');
    } finally {
      setDeletingThread(null);
    }
  }

  function clearChat() {
    if (!confirm('Limpar conversa? O histórico salvo não será apagado.')) return;
    setMessages([]);
  }

  async function createTask() {
    if (!taskForm.title.trim()) return;
    setSavingTask(true);
    try {
      const agent = selectedAgents[0];
      await api.post('/issues', {
        title: taskForm.title.trim(),
        description: taskForm.description.trim(),
        priority: taskForm.priority,
        assigneeAgentId: agent?.id,
        assigneeAgentName: agent?.name,
        status: 'todo',
      });
      setShowTaskModal(false);
      setTaskForm({ title: '', description: '', priority: 'medio' });
      showToast('✓ Tarefa criada!');
    } catch {
      showToast('❌ Erro ao criar tarefa');
    } finally {
      setSavingTask(false);
    }
  }

  const userJson = localStorage.getItem('user');
  const user = userJson ? JSON.parse(userJson) : null;
  const userInitials = user?.name?.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() ?? '?';
  const currentModel = selectedAgents.length === 1
    ? modelShort(selectedAgents[0].model)
    : null;

  return (
    <div className="chat-layout">
      {/* Thread list (left) */}
      <div className="chat-threads">
        <div className="chat-threads-header">
          <h3>Conversas</h3>
          <button
            className="icon-btn"
            title="Nova conversa"
            onClick={() => { setMessages([]); setSelectedAgents([]); navigate('/chat'); }}
          >+</button>
        </div>
        <div className="chat-threads-list">
          {loadingAgents ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>Carregando...</div>
          ) : agents.length === 0 ? (
            <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>
              Nenhum agente.{' '}
              <span style={{ color: '#c084fc', cursor: 'pointer' }} onClick={() => navigate('/agents')}>
                Contratar →
              </span>
            </div>
          ) : (
            <>
              <div
                className={`thread-item${!agentId && selectedAgents.length === 0 ? ' active' : ''}`}
                onClick={() => { setSelectedAgents([]); setMessages([]); navigate('/chat'); }}
              >
                <div className="thread-agents">
                  <div className="thread-agent-dot" style={{ background: 'linear-gradient(135deg,#9230F9,#00BC8A)' }}>✨</div>
                </div>
                <div className="thread-info">
                  <div className="thread-title">Assistente Geral</div>
                  <div className="thread-preview">Chat sem agente específico</div>
                </div>
              </div>

              <div style={{ height: 8 }} />

              {agents.map(agent => (
                <div
                  key={agent.id}
                  className={`thread-item${agentId === agent.id ? ' active' : ''}`}
                  onClick={() => { setSelectedAgents([agent]); navigate(`/chat/${agent.id}`); }}
                  style={{ position: 'relative' }}
                >
                  <div className="thread-agents">
                    <div className="thread-agent-dot">{agentEmoji(agent.role)}</div>
                  </div>
                  <div className="thread-info">
                    <div className="thread-title">{agent.name}</div>
                    <div className="thread-preview">{agent.role}</div>
                  </div>
                  <button
                    className="ghost"
                    title="Apagar histórico da conversa"
                    onClick={e => deleteThread(agent.id, e)}
                    disabled={deletingThread === agent.id}
                    style={{
                      padding: '2px 7px', fontSize: 11,
                      color: deletingThread === agent.id ? 'var(--muted)' : 'var(--danger)',
                      borderColor: 'transparent',
                      flexShrink: 0,
                      opacity: 0.55,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.55')}
                  >
                    {deletingThread === agent.id ? '…' : '🗑'}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Chat window */}
      <div className="chat-window">
        {/* Agent bar */}
        <div className="chat-agent-bar">
          <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Falando com:</span>

          {selectedAgents.length === 0 && (
            <span className="agent-chip" style={{ color: 'var(--muted)', background: 'transparent', border: '1px dashed var(--border-2)' }}>
              ✨ Assistente Geral
            </span>
          )}

          {selectedAgents.map(agent => (
            <span key={agent.id} className="agent-chip selected">
              {agentEmoji(agent.role)} {agent.name}
              <span className="agent-chip-remove" onClick={() => removeAgent(agent.id)} title="Remover">×</span>
            </span>
          ))}

          {/* Model badge */}
          {currentModel && (
            <span className="badge badge-gray" style={{ fontSize: 10, fontFamily: 'monospace' }}>
              🧠 {currentModel}
            </span>
          )}

          {/* Criar tarefa (só quando há agente selecionado) */}
          {selectedAgents.length >= 1 && (
            <button
              className="ghost"
              style={{ fontSize: 11, padding: '4px 10px', color: 'var(--primary)' }}
              title="Criar tarefa para este agente"
              onClick={() => setShowTaskModal(true)}
            >
              📋 Criar tarefa
            </button>
          )}

          {/* Add agent */}
          <div style={{ position: 'relative', marginLeft: 'auto' }}>
            <button className="add-agent-btn" onClick={() => setShowAgentPicker(p => !p)}>
              + agente
            </button>
            {showAgentPicker && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 6,
                background: 'var(--bg-3)', border: '1px solid var(--border-2)',
                borderRadius: 'var(--radius)', padding: 6, minWidth: 220, zIndex: 20,
                boxShadow: 'var(--shadow-md)',
              }}>
                {agents.map(agent => {
                  const selected = selectedAgents.some(a => a.id === agent.id);
                  return (
                    <div
                      key={agent.id}
                      onClick={() => toggleAgent(agent)}
                      style={{
                        padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8,
                        background: selected ? 'var(--primary-dim)' : 'transparent',
                        fontSize: 13, color: selected ? '#c084fc' : 'var(--fg-2)',
                      }}
                    >
                      <span>{agentEmoji(agent.role)}</span>
                      <div>
                        <div style={{ fontWeight: 500 }}>{agent.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{agent.role}</div>
                      </div>
                      {selected && <span style={{ marginLeft: 'auto' }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button
              className="ghost"
              style={{ fontSize: 11, padding: '3px 8px', color: 'var(--muted)' }}
              title="Limpar conversa"
              onClick={clearChat}
            >
              🗑
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="chat-messages" onClick={() => setShowAgentPicker(false)}>
          {loadingHistory && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--muted)', fontSize: 13 }}>
              Carregando histórico...
            </div>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="chat-empty">
              <div className="chat-empty-icon">
                {selectedAgents.length === 0 ? '✨' : agentEmoji(selectedAgents[0]?.role)}
              </div>
              <h3>
                {selectedAgents.length === 0
                  ? 'Assistente Geral'
                  : selectedAgents.length === 1
                  ? selectedAgents[0].name
                  : `${selectedAgents.length} agentes`}
              </h3>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                {selectedAgents.length === 0
                  ? 'Chat livre com IA. Sem agente específico.'
                  : selectedAgents.length === 1
                  ? `Converse com ${selectedAgents[0].name} — ${selectedAgents[0].role}`
                  : `Os agentes ${selectedAgents.map(a => a.name).join(', ')} responderão em sequência.`}
              </p>
              <div className="chat-suggestion-chips">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-chip" onClick={() => send(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}

          {!loadingHistory && messages.map((msg, i) => {
            if (msg.role === 'system') {
              return (
                <div key={i} className="msg system">
                  <div className="msg-bubble" style={{ maxWidth: '100%', textAlign: 'center', fontSize: 12 }}>
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
                  {isUser ? userInitials : (agentForMsg ? agentEmoji(agentForMsg.role) : '🤖')}
                </div>
                <div className="msg-body">
                  <div className="msg-meta">
                    <span className="msg-name">
                      {isUser ? (user?.name || 'Você') : (msg.agentName || 'Agente')}
                    </span>
                    <span className="msg-time">{formatTime(msg.timestamp)}</span>
                    {msg.model && !isUser && (
                      <span style={{
                        fontSize: 10, color: 'var(--muted)', fontFamily: 'monospace',
                        background: 'var(--bg-3)', padding: '1px 6px', borderRadius: 4,
                      }}>
                        🧠 {modelShort(msg.model)}
                      </span>
                    )}
                    {/* Delete message button */}
                    <button
                      className="ghost"
                      style={{ marginLeft: 'auto', padding: '1px 6px', fontSize: 11, opacity: 0.4 }}
                      title="Remover mensagem"
                      onClick={() => deleteMessage(i)}
                    >×</button>
                  </div>
                  <div className="msg-bubble">
                    <MessageRenderer content={msg.content} />
                  </div>

                  {/* Approval request buttons */}
                  {msg.needsApproval && !isUser && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        style={{ fontSize: 12, padding: '6px 14px', background: 'rgba(0,188,138,0.15)', borderColor: 'var(--secondary)', color: 'var(--secondary)' }}
                        onClick={() => approveAction(msg, true)}
                      >
                        ✅ Aprovar ação
                      </button>
                      <button
                        className="ghost"
                        style={{ fontSize: 12, padding: '6px 14px', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                        onClick={() => approveAction(msg, false)}
                      >
                        ❌ Cancelar ação
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

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
            {sending ? (
              <button
                className="chat-send-btn"
                onClick={cancelSend}
                title="Cancelar envio"
                style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
              >
                ✕
              </button>
            ) : (
              <button
                className="chat-send-btn"
                onClick={() => send()}
                disabled={!input.trim()}
                title="Enviar (Enter)"
              >
                ↑
              </button>
            )}
          </div>
          <div className="chat-input-hint">
            <span><kbd>Enter</kbd> envia · <kbd>Shift+Enter</kbd> quebra linha</span>
            {selectedAgents.length === 1 && currentModel && (
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>
                modelo: {currentModel}
              </span>
            )}
            {selectedAgents.length > 1 && (
              <span style={{ color: '#c084fc' }}>
                Multi-agente: {selectedAgents.map(a => a.name).join(' → ')}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Modal criar tarefa */}
      {showTaskModal && (
        <div className="modal-overlay" onClick={() => setShowTaskModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 440 }}>
            <h2 style={{ marginBottom: 16 }}>
              📋 Criar tarefa{selectedAgents[0] ? ` para ${selectedAgents[0].name}` : ''}
            </h2>

            <div className="form-group">
              <label>Título *</label>
              <input
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="O que precisa ser feito?"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') createTask(); }}
              />
            </div>

            <div className="form-group">
              <label>Descrição</label>
              <textarea
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Contexto ou detalhes adicionais..."
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="form-group">
              <label>Prioridade</label>
              <select
                value={taskForm.priority}
                onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
              >
                <option value="critico">🔴 Crítica</option>
                <option value="alto">🟠 Alta</option>
                <option value="medio">🟡 Média</option>
                <option value="baixo">⚪ Baixa</option>
              </select>
            </div>

            {selectedAgents[0] && (
              <div style={{
                fontSize: 12, color: 'var(--muted)', marginBottom: 16,
                padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 6,
              }}>
                → Será atribuída a <strong style={{ color: 'var(--primary)' }}>{selectedAgents[0].name}</strong>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="ghost" onClick={() => setShowTaskModal(false)}>Cancelar</button>
              <button onClick={createTask} disabled={!taskForm.title.trim() || savingTask}>
                {savingTask ? 'Criando...' : '✓ Criar tarefa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--bg-3)', border: '1px solid var(--border-2)',
          color: 'var(--fg)', padding: '8px 18px', borderRadius: 20,
          fontSize: 13, fontWeight: 500, zIndex: 999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
