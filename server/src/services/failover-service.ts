import { createFailoverAdapter, getAdapter } from '@mwcode/adapters';
import type { Adapter, AdapterName } from '@mwcode/shared';
import { DEFAULT_FAILOVER_ORDER } from '@mwcode/shared';

export function buildAdapter(primary: { adapter: AdapterName; model: string }): Adapter {
  const enabled = (process.env.MWCODE_FAILOVER ?? 'true') === 'true';
  const primaryAdapter = getAdapter(primary.adapter, primary.model);

  if (!enabled) return primaryAdapter;

  const orderEnv = process.env.MWCODE_FAILOVER_ORDER;
  const order = orderEnv ? orderEnv.split(',').map(s => s.trim()) : DEFAULT_FAILOVER_ORDER;

  const backups: Adapter[] = [];
  for (const entry of order) {
    const [name, ...modelParts] = entry.split('/');
    const model = modelParts.join('/');
    if (!name || !model) continue;
    try {
      backups.push(getAdapter(name as AdapterName, model));
    } catch {
      continue;
    }
  }

  return createFailoverAdapter({
    adapters: [primaryAdapter, ...backups]
  });
}
