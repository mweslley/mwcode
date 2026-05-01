/**
 * Loop autônomo de agentes — CEO acorda periodicamente,
 * cria tarefas, delega para agentes e escala ao humano quando necessário.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';
import { sendMessageToAgent } from '../lib/agent-chat.js';

function hireAgent(userId: string, ceoModel: string, hire: { name: string; role: string; instructions: string; model: string }): any {
  const id = crypto.randomUUID();
  const agent = {
    id, userId,
    name: hire.name,
    role: hire.role,
    personality: hire.instructions ||
      `Você é ${hire.name}, responsável por ${hire.role}. Responda sempre em português brasileiro.`,
    goals: [],
    skills: [],
    model: hire.model || ceoModel || 'openrouter/auto',
    provider: 'openrouter',
    status: 'active',
    hireDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: 'CEO',
  };
  const dir = dataDir('agents', userId);
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  return agent;
}

// ── Tipos internos ────────────────────────────────────────────────────────────

interface Agent {
  id: string; name: string; role: string; status: string; model?: string;
}

interface Issue {
  id: string; userId: string; title: string; description: string;
  status: string; priority: string;
  assigneeAgentId?: string; assigneeAgentName?: string;
  createdByAgentId?: string; createdByAgentName?: string;
  requiresApproval: boolean; approvalStatus?: string;
  createdAt: string; updatedAt: string; completedAt?: string;
}

// ── Helpers de dados ──────────────────────────────────────────────────────────

function loadAgents(userId: string): Agent[] {
  try {
    const dir = dataDir('agents', userId);
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
      .filter(a => a?.status === 'active');
  } catch { return []; }
}

function loadIssues(userId: string): Issue[] {
  const file = dataPath('issues', `${userId}.json`);
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return []; }
}

function saveIssues(userId: string, issues: Issue[]): void {
  dataDir('issues'); // garante que a pasta existe
  fs.writeFileSync(dataPath('issues', `${userId}.json`), JSON.stringify(issues, null, 2));
}

function loadCompany(userId: string): any {
  // Tenta o path direto primeiro, depois caminho alternativo
  for (const file of [
    dataPath('company', `${userId}.json`),
    path.join(dataDir('company'), `${userId}.json`),
  ]) {
    if (fs.existsSync(file)) {
      try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch {}
    }
  }
  return null;
}

function getAllUserIds(): string[] {
  const usersFile = dataPath('users.json');
  if (!fs.existsSync(usersFile)) return [];
  try {
    return (JSON.parse(fs.readFileSync(usersFile, 'utf-8')) || [])
      .map((u: any) => u.id).filter(Boolean);
  } catch { return []; }
}

function findCEO(agents: Agent[]): Agent | null {
  return agents.find(a =>
    a.role?.toLowerCase().includes('ceo') || a.name?.toLowerCase() === 'ceo'
  ) || null;
}

function findAgentByName(agents: Agent[], name: string): Agent | null {
  if (!name) return null;
  const n = name.toLowerCase().trim();
  return agents.find(a =>
    a.name?.toLowerCase() === n ||
    a.name?.toLowerCase().includes(n) ||
    a.role?.toLowerCase().includes(n)
  ) || null;
}

// ── Parser de comandos na resposta do CEO ────────────────────────────────────

interface ParsedCommands {
  tasks: Array<{ title: string; agentName: string; description: string; priority: string }>;
  approvals: Array<{ title: string; description: string }>;
  hires: Array<{ name: string; role: string; instructions: string; model: string }>;
}

function parseCEOResponse(content: string): ParsedCommands {
  const tasks: ParsedCommands['tasks'] = [];
  const approvals: ParsedCommands['approvals'] = [];
  const hires: ParsedCommands['hires'] = [];

  // [CRIAR TAREFA: título="..."; agente="..."; descrição="..."; prioridade="..."]
  const taskRe = /\[CRIAR TAREFA:([^\]]+)\]/gi;
  let m;
  while ((m = taskRe.exec(content)) !== null) {
    const p = m[1];
    const title =
      p.match(/t[íi]tulo=["']([^"']+)["']/i)?.[1] ||
      p.match(/titulo=["']([^"']+)["']/i)?.[1] ||
      p.match(/title=["']([^"']+)["']/i)?.[1];
    const agentName = p.match(/agente=["']([^"']+)["']/i)?.[1] || '';
    const description =
      p.match(/descri[çc][aã]o=["']([^"']+)["']/i)?.[1] ||
      p.match(/desc=["']([^"']+)["']/i)?.[1] || '';
    const priority = p.match(/prioridade=["']([^"']+)["']/i)?.[1] || 'medio';
    if (title) tasks.push({ title, agentName, description, priority });
  }

  // [CONTRATAR AGENTE: nome="..."; função="..."; instruções="..."; modelo="..."]
  const hireRe = /\[CONTRATAR AGENTE:([^\]]+)\]/gi;
  while ((m = hireRe.exec(content)) !== null) {
    const p = m[1];
    const name =
      p.match(/nome=["']([^"']+)["']/i)?.[1] ||
      p.match(/name=["']([^"']+)["']/i)?.[1];
    const role =
      p.match(/fun[çc][aã]o=["']([^"']+)["']/i)?.[1] ||
      p.match(/funcao=["']([^"']+)["']/i)?.[1] ||
      p.match(/role=["']([^"']+)["']/i)?.[1] || '';
    const instructions =
      p.match(/instru[çc][oõ]es=["']([^"']+)["']/i)?.[1] ||
      p.match(/descri[çc][aã]o=["']([^"']+)["']/i)?.[1] ||
      p.match(/desc=["']([^"']+)["']/i)?.[1] || '';
    const model = p.match(/modelo=["']([^"']+)["']/i)?.[1] || 'openrouter/auto';
    if (name) hires.push({ name, role, instructions, model });
  }

  // [APROVAÇÃO NECESSÁRIA: ...]  ou  [APROVAÇÃO NECESSÁRIA] (sem parâmetros)
  const aprRe = /\[APROVAÇÃO NECESSÁRIA[:\s]*([^\]]*)\]/gi;
  while ((m = aprRe.exec(content)) !== null) {
    const desc = m[1]?.trim() || content.slice(0, 400);
    approvals.push({ title: 'CEO solicita aprovação', description: desc });
  }
  // fallback inglês
  const aprReEn = /\[APPROVAL NEEDED[:\s]*([^\]]*)\]/gi;
  while ((m = aprReEn.exec(content)) !== null) {
    approvals.push({ title: 'CEO solicita aprovação', description: m[1]?.trim() || content.slice(0, 400) });
  }

  return { tasks, approvals, hires };
}

// ── Executar comandos criados pelo CEO ────────────────────────────────────────

function executeCommands(
  userId: string,
  ceo: Agent,
  commands: ParsedCommands,
  agents: Agent[]
): void {
  if (!commands.tasks.length && !commands.approvals.length && !commands.hires.length) return;

  // ── Contratar novos agentes ──────────────────────────────────────────────
  const company = loadCompany(userId);
  const ceoModel = company?.ceoModel || ceo?.model || 'openrouter/auto';

  for (const hire of commands.hires) {
    // Evita duplicata de agente com mesmo nome
    const exists = agents.find(a =>
      a.name?.toLowerCase().trim() === hire.name.toLowerCase().trim()
    );
    if (exists) {
      console.log(`[AgentLoop] Agente "${hire.name}" já existe, pulando contratação`);
      continue;
    }
    const newAgent = hireAgent(userId, ceoModel, hire);
    agents.push(newAgent); // disponível nas tarefas desta mesma execução
    console.log(`[AgentLoop] CEO contratou: "${hire.name}" (${hire.role})`);

    // Apresenta o novo agente
    const introMsg =
      `[CEO — Bem-vindo à equipe]\n\n` +
      `Você foi contratado como ${hire.role}. ` +
      (hire.instructions ? `Suas instruções: ${hire.instructions}. ` : '') +
      `Apresente-se brevemente e confirme que está pronto para receber tarefas.`;
    sendMessageToAgent(userId, newAgent.id, introMsg, { source: 'CEO' })
      .catch(e => console.error(`[AgentLoop] Erro ao apresentar ${hire.name}:`, e.message));
  }

  const issues = loadIssues(userId);
  const now = new Date().toISOString();

  for (const task of commands.tasks) {
    const assignee = findAgentByName(agents, task.agentName);

    // Evita duplicatas: não cria tarefa com mesmo título criada nos últimos 10 min
    const recent = issues.find(i =>
      i.title.toLowerCase() === task.title.toLowerCase() &&
      Date.now() - new Date(i.createdAt).getTime() < 10 * 60 * 1000
    );
    if (recent) continue;

    const issue: Issue = {
      id: crypto.randomUUID(),
      userId,
      title: task.title,
      description: task.description,
      status: 'todo',
      priority: ['critico','alto','medio','baixo'].includes(task.priority) ? task.priority : 'medio',
      assigneeAgentId: assignee?.id,
      assigneeAgentName: assignee?.name || task.agentName || undefined,
      createdByAgentId: ceo.id,
      createdByAgentName: ceo.name,
      requiresApproval: false,
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    console.log(`[AgentLoop] CEO criou tarefa: "${task.title}" → ${assignee?.name || task.agentName || 'sem agente'}`);

    // Notifica agente responsável
    if (assignee) {
      const msg =
        `[CEO — Nova Tarefa Atribuída]\n\n` +
        `Tarefa: ${task.title}\n` +
        (task.description ? `Descrição: ${task.description}\n` : '') +
        `\nExecute esta tarefa e reporte o resultado. ` +
        `Quando concluir, me informe o que foi feito e qualquer obstáculo encontrado.`;
      sendMessageToAgent(userId, assignee.id, msg, { source: 'CEO' })
        .catch(e => console.error(`[AgentLoop] Erro ao notificar ${assignee.name}:`, e.message));
    }
  }

  for (const approval of commands.approvals) {
    // Evita duplicatas de aprovação recentes
    const recent = issues.find(i =>
      i.requiresApproval &&
      i.approvalStatus === 'pendente' &&
      i.title === approval.title &&
      Date.now() - new Date(i.createdAt).getTime() < 30 * 60 * 1000
    );
    if (recent) continue;

    const issue: Issue = {
      id: crypto.randomUUID(),
      userId,
      title: approval.title,
      description: approval.description,
      status: 'todo',
      priority: 'alto',
      createdByAgentId: ceo.id,
      createdByAgentName: ceo.name,
      requiresApproval: true,
      approvalStatus: 'pendente',
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    console.log(`[AgentLoop] CEO solicitou aprovação humana: "${approval.title}"`);
  }

  saveIssues(userId, issues);
}

// ── Heartbeat do CEO ──────────────────────────────────────────────────────────

export async function runCEOHeartbeat(userId: string): Promise<void> {
  try {
    const agents = loadAgents(userId);
    const ceo = findCEO(agents);
    if (!ceo) return;

    const company = loadCompany(userId);
    if (!company) return; // sem empresa configurada, não faz nada

    const issues = loadIssues(userId);
    const pending   = issues.filter(i => ['todo','backlog'].includes(i.status));
    const inProgress = issues.filter(i => i.status === 'em_progresso');
    const recentDone = issues.filter(i => i.status === 'concluido')
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    const otherAgents = agents.filter(a => a.id !== ceo.id);

    const contextMsg =
      `[Sistema MWCode — Atualização Automática]\n\n` +
      `Empresa: ${company.companyName || company.name || 'sua empresa'}\n` +
      `Missão: ${company.mission || 'crescer com agentes de IA'}\n` +
      (company.area ? `Área: ${company.area}\n` : '') +
      (company.goals?.length ? `Objetivos: ${company.goals.join('; ')}\n` : '') +
      `\nAgentes disponíveis (${otherAgents.length}):\n` +
      (otherAgents.length
        ? otherAgents.map(a => `- ${a.name}: ${a.role}`).join('\n')
        : '- Nenhum agente além de você ainda') +
      `\n\nTarefas em andamento (${inProgress.length}):\n` +
      (inProgress.length ? inProgress.map(i => `- [${i.assigneeAgentName || 'sem agente'}] ${i.title}`).join('\n') : '- Nenhuma') +
      `\n\nTarefas pendentes (${pending.length}):\n` +
      (pending.length ? pending.map(i => `- [${i.assigneeAgentName || 'sem agente'}] ${i.title}`).join('\n') : '- Nenhuma') +
      `\n\nConcluídas recentemente:\n` +
      (recentDone.length ? recentDone.map(i => `- ${i.title} (${i.assigneeAgentName || 'sem agente'})`).join('\n') : '- Nenhuma') +
      `\n\n---\nCom base nas informações acima, tome as ações necessárias AGORA:\n` +
      `\nA) Se precisar de novos agentes, contrate-os com:\n` +
      `   [CONTRATAR AGENTE: nome="Nome do Agente"; função="Cargo/Função"; instruções="Descrição de responsabilidades"; modelo="openrouter/auto"]\n` +
      `\nB) Crie tarefas práticas para avançar os objetivos:\n` +
      `   [CRIAR TAREFA: título="..."; agente="Nome Exato do Agente"; descrição="..."; prioridade="medio"]\n` +
      `\nC) Se precisar de decisão humana:\n` +
      `   [APROVAÇÃO NECESSÁRIA: descreva claramente o que precisa ser decidido]\n` +
      `\nRegras: Seja direto e objetivo. ${otherAgents.length === 0 ? 'Você não tem agentes — contrate pelo menos 2 agentes especializados para a área da empresa AGORA.' : 'Crie pelo menos 2 tarefas concretas para os agentes disponíveis.'}`;

    console.log(`[AgentLoop] Heartbeat CEO — userId: ${userId}`);
    const response = await sendMessageToAgent(userId, ceo.id, contextMsg, { source: 'Sistema' });
    const commands = parseCEOResponse(response);
    executeCommands(userId, ceo, commands, agents);
  } catch (e: any) {
    console.error(`[AgentLoop] Erro no heartbeat do CEO (userId ${userId}):`, e.message);
  }
}

// ── Notificar CEO quando tarefa é concluída ───────────────────────────────────

export async function notifyCEOTaskComplete(userId: string, issue: any): Promise<void> {
  try {
    const agents = loadAgents(userId);
    const ceo = findCEO(agents);
    if (!ceo || !issue.assigneeAgentId || issue.assigneeAgentId === ceo.id) return;

    const msg =
      `[Relatório — Tarefa Concluída]\n\n` +
      `Agente: ${issue.assigneeAgentName || 'Agente'}\n` +
      `Tarefa: "${issue.title}"\n` +
      (issue.description ? `Detalhes: ${issue.description}\n` : '') +
      `\nRevise o trabalho. Se necessário:\n` +
      `- Crie tarefas de acompanhamento: [CRIAR TAREFA: título="..."; agente="..."; descrição="..."; prioridade="medio"]\n` +
      `- Solicite aprovação humana: [APROVAÇÃO NECESSÁRIA: o que precisa ser decidido]\n` +
      `- Ou apenas confirme que está tudo bem e indique os próximos passos.`;

    const response = await sendMessageToAgent(userId, ceo.id, msg, { source: issue.assigneeAgentName || 'Agente' });
    const commands = parseCEOResponse(response);
    executeCommands(userId, ceo, commands, agents);
  } catch (e: any) {
    console.error(`[AgentLoop] Erro ao notificar CEO sobre tarefa concluída:`, e.message);
  }
}

// ── Bootstrap imediato quando empresa é criada ────────────────────────────────

/** Chamado quando o usuário finaliza o onboarding. CEO age imediatamente. */
export async function bootstrapCEO(userId: string): Promise<void> {
  // Pequeno delay para garantir que a empresa foi salva no disco
  setTimeout(() => runCEOHeartbeat(userId).catch(() => {}), 2000);
}

// ── Iniciar o loop ────────────────────────────────────────────────────────────

export function startAgentLoop(): void {
  const INTERVAL_HOURS = Math.max(1, Number(process.env.CEO_HEARTBEAT_HOURS || 4));
  const INTERVAL_MS = INTERVAL_HOURS * 60 * 60 * 1000;

  // Primeira execução 3 minutos após o startup (aguarda sistema carregar)
  setTimeout(async () => {
    for (const userId of getAllUserIds()) {
      await runCEOHeartbeat(userId);
    }
  }, 3 * 60 * 1000);

  // Loop periódico
  setInterval(async () => {
    for (const userId of getAllUserIds()) {
      await runCEOHeartbeat(userId);
    }
  }, INTERVAL_MS);

  console.log(`[MWCode] Loop autônomo iniciado — CEO acorda a cada ${INTERVAL_HOURS}h (env: CEO_HEARTBEAT_HOURS)`);
}
