import type { Agent, Company, Chat, Task } from '@mwcode/shared';

interface Store {
  companies: Map<string, Company>;
  agents: Map<string, Agent>;
  chats: Map<string, Chat>;
  tasks: Map<string, Task>;
}

export const memoryStore: Store = {
  companies: new Map(),
  agents: new Map(),
  chats: new Map(),
  tasks: new Map()
};

memoryStore.companies.set('default', {
  id: 'default',
  name: 'Empresa Padrão',
  plan: 'free',
  budget: 0,
  spent: 0,
  createdAt: new Date()
});
