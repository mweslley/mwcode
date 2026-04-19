import { useState } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatWindow } from '../components/ChatWindow';

export function ChatSingle() {
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('openrouter/auto');
  const { messages, loading, sendSingle } = useChat();

  return (
    <div>
      <h1>Modo Single — Chat Direto</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
        Converse direto com um provedor sem contratar agente.
      </p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Provedor</label>
          <select value={provider} onChange={e => setProvider(e.target.value)}>
            <option value="openrouter">OpenRouter</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        <div style={{ flex: 2 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }}>Modelo</label>
          <input value={model} onChange={e => setModel(e.target.value)} />
        </div>
      </div>

      <ChatWindow
        messages={messages}
        loading={loading}
        onSend={t => sendSingle(t, provider, model)}
        placeholder="Digite sua mensagem (português brasileiro)..."
      />
    </div>
  );
}
