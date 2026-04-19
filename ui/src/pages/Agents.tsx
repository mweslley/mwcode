import { useState } from 'react';
import { useAgents } from '../hooks/useAgents';
import { AgentCard } from '../components/AgentCard';
import { HireModal } from '../components/HireModal';

export function Agents() {
  const { agents, hire, fire } = useAgents();
  const [showModal, setShowModal] = useState(false);

  async function handleFire(id: string) {
    const reason = prompt('Motivo da demissão:') || 'Não especificado';
    await fire(id, reason);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Agentes</h1>
        <button onClick={() => setShowModal(true)}>+ Contratar</button>
      </div>

      {agents.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Nenhum agente cadastrado.</p>
      ) : (
        <div className="agents-grid">
          {agents.map(a => <AgentCard key={a.id} agent={a} onFire={handleFire} />)}
        </div>
      )}

      {showModal && (
        <HireModal
          onSubmit={hire}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
