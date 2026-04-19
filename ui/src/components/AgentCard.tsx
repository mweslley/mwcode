import { Link } from 'react-router-dom';

interface Props {
  agent: any;
  onFire?: (id: string) => void;
}

export function AgentCard({ agent, onFire }: Props) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h3 style={{ fontSize: 16 }}>{agent.name}</h3>
          <p style={{ color: 'var(--muted)', fontSize: 12 }}>{agent.role}</p>
        </div>
        <span className={`badge ${agent.status === 'active' ? 'active' : 'fired'}`}>
          {agent.status === 'active' ? 'Ativo' : 'Demitido'}
        </span>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)' }}>
        <div>Provedor: {agent.adapter} / {agent.model}</div>
        <div>Tarefas: {agent.tasksCompleted} — Desempenho: {agent.performance}%</div>
      </div>

      {agent.status === 'active' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Link to={`/chat/${agent.id}`}>
            <button>Conversar</button>
          </Link>
          {onFire && (
            <button className="danger" onClick={() => onFire(agent.id)}>Demitir</button>
          )}
        </div>
      )}
    </div>
  );
}
