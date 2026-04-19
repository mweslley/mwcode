import { useRef, useState, useEffect } from 'react';

interface Msg {
  role: 'user' | 'agent' | 'system';
  content: string;
}

interface Props {
  messages: Msg[];
  loading: boolean;
  onSend: (text: string) => void;
  placeholder?: string;
}

export function ChatWindow({ messages, loading, onSend, placeholder }: Props) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function submit() {
    if (!text.trim() || loading) return;
    onSend(text);
    setText('');
  }

  return (
    <div className="chat-container">
      <div className="messages">
        {messages.length === 0 && (
          <p style={{ color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
            Nenhuma mensagem ainda. Digite abaixo para começar.
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`message ${m.role}`}>
            <strong style={{ fontSize: 11, opacity: 0.7, display: 'block', marginBottom: 4 }}>
              {m.role === 'user' ? 'Você' : m.role === 'agent' ? 'Agente' : 'Sistema'}
            </strong>
            {m.content}
          </div>
        ))}
        {loading && <div className="message agent">Digitando...</div>}
        <div ref={endRef} />
      </div>

      <div className="input-area">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder || 'Digite sua mensagem...'}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button onClick={submit} disabled={loading || !text.trim()}>Enviar</button>
      </div>
    </div>
  );
}
