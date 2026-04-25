import { useState } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatWindow } from '../components/ChatWindow';
import { ModeSwitcher } from '../components/ModeSwitcher';
import { ModelPicker } from '../components/ModelPicker';

export function ChatSingle() {
  const [provider, setProvider] = useState('openrouter');
  const [model, setModel] = useState('openrouter/auto');
  const { messages, loading, sendSingle } = useChat();

  return (
    <div>
      <ModeSwitcher />
      <h1>Conversa Direta</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
        Converse direto com a IA sem contratar agente. Escolha o provedor e o modelo abaixo.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            Provedor
          </label>
          <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ width: '100%' }}>
            <option value="openrouter">OpenRouter (recomendado)</option>
            <option value="openai">OpenAI</option>
            <option value="gemini">Gemini</option>
            <option value="ollama">Ollama (local)</option>
            <option value="deepseek">DeepSeek</option>
          </select>
        </div>
        <div>
          {provider === 'openrouter' ? (
            <ModelPicker value={model} onChange={setModel} mostrarPagos />
          ) : (
            <>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                Modelo
              </label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="ex: gpt-4o-mini"
                style={{ width: '100%' }}
              />
            </>
          )}
        </div>
      </div>

      <ChatWindow
        messages={messages}
        loading={loading}
        onSend={(t) => sendSingle(t, provider, model)}
        placeholder="Digite sua mensagem em português brasileiro..."
      />
    </div>
  );
}
