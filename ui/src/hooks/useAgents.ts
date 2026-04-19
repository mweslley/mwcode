import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export function useAgents() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await api.listAgents());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const hire = useCallback(async (data: any) => {
    await api.hireAgent(data);
    await load();
  }, [load]);

  const fire = useCallback(async (id: string, reason: string) => {
    await api.fireAgent(id, reason);
    await load();
  }, [load]);

  return { agents, loading, error, reload: load, hire, fire };
}
