import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { useChat } from '../hooks/useChat';
import { ChatWindow } from '../components/ChatWindow';

export function Chat() {
  const { agentId: paramId } = useParams();
  const { agents } = useAgents();
  const [selected, setSelected] = useState<string | undefined>(paramId);

  const currentId = selected || paramId;
  const { messages, loading, send } = useChat(currentId);
  const agent = agents.find(a => a.id === currentId);

  if (!currentId) {
    return (
      <div>
        <h1>Conversar com Agente</h1>
        <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Selecione um agente:</p>
        {agents.length === 0 ? (
          <p>Nenhum agente disponível. Contrate um primeiro.</p>
        ) : (
          <select onChange={e => setSelected(e.target.value)} defaultValue="">
            <option value="" disabled>-- Escolha --</option>
            {agents.filter(a => a.status === 'active').map(a => (
              <option key={a.id} value={a.id}>{a.name} — {a.role}</option>
            ))}
          </select>
        )}
      </div>
    );
  }

  return (
    <div>
      <h1>{agent?.name || 'Chat'}</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
        {agent?.role} — {agent?.adapter}/{agent?.model}
      </p>
      <ChatWindow messages={messages} loading={loading} onSend={send} />
    </div>
  );
}
