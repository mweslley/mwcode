import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { StatsCard } from '../components/StatsCard';
import { AgentCard } from '../components/AgentCard';
import { useAgents } from '../hooks/useAgents';

export function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const { agents } = useAgents();

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(() => setStats(null));
  }, []);

  const activeAgents = agents.filter(a => a.status === 'active');

  return (
    <div>
      <h1>Dashboard</h1>

      <div className="stats-grid">
        <StatsCard title="Agentes Ativos" value={stats?.agentesAtivos ?? 0} icon="👥" />
        <StatsCard title="Tarefas Concluídas" value={stats?.tarefasConcluidas ?? 0} icon="✅" />
        <StatsCard title="Custo Total" value={`R$ ${(stats?.custoTotal ?? 0).toFixed(2)}`} icon="💰" />
        <StatsCard title="Performance Média" value={`${stats?.performanceMedia ?? 0}%`} icon="📈" />
      </div>

      <h2>Agentes Ativos</h2>
      {activeAgents.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>Nenhum agente ativo. Contrate seu primeiro agente.</p>
      ) : (
        <div className="agents-grid">
          {activeAgents.map(a => <AgentCard key={a.id} agent={a} />)}
        </div>
      )}
    </div>
  );
}
