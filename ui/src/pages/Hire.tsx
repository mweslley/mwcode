import { useNavigate } from 'react-router-dom';
import { HireModal } from '../components/HireModal';
import { useAgents } from '../hooks/useAgents';

export function Hire() {
  const navigate = useNavigate();
  const { hire } = useAgents();

  async function handleSubmit(data: any) {
    await hire(data);
    navigate('/agentes');
  }

  return (
    <div>
      <h1>Contratar Agente</h1>
      <HireModal onSubmit={handleSubmit} onClose={() => navigate('/agentes')} />
    </div>
  );
}
