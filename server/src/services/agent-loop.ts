/**
 * Loop autônomo de agentes — CEO acorda periodicamente,
 * cria tarefas, delega para agentes e escala ao humano quando necessário.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';
import { sendMessageToAgent } from '../lib/agent-chat.js';

// ── Hierarquia corporativa padrão ─────────────────────────────────────────────

const CORPORATE_ROLES: Record<string, string> = {
  'COO': 'Chief Operating Officer — Diretor de Operações. Responsável pela execução operacional: operações, logística, atendimento e produção.',
  'CFO': 'Chief Financial Officer — Diretor Financeiro. Responsável por finanças, orçamento, contabilidade, controladoria e auditoria.',
  'CTO': 'Chief Technology Officer — Diretor de Tecnologia. Responsável por engenharia de software, infraestrutura, DevOps, segurança e arquitetura.',
  'CIO': 'Chief Information Officer — Diretor de TI. Responsável por sistemas internos, help desk, redes e governança de TI.',
  'CMO': 'Chief Marketing Officer — Diretor de Marketing. Responsável por branding, performance, conteúdo, social media e growth.',
  'CPO': 'Chief Product Officer — Diretor de Produto. Responsável por estratégia de produto, UX/UI, pesquisa e product design.',
  'CHRO': 'Chief Human Resources Officer — Diretor de RH. Responsável por recrutamento, people ops, treinamento e cultura.',
  'CCO': 'Chief Commercial Officer — Diretor Comercial. Responsável por vendas, customer success, parcerias e expansão.',
  'CRO': 'Chief Revenue Officer — Diretor de Receita. Responsável por revenue operations, estratégia comercial e crescimento financeiro.',
  'CISO': 'Chief Information Security Officer — Diretor de Segurança. Responsável por cibersegurança, SOC, compliance e gestão de incidentes.',
  'CLO': 'Chief Legal Officer — Diretor Jurídico. Responsável por compliance legal, contratos e governança regulatória.',
  'VP': 'Vice-Presidente — Responsável por divisões estratégicas abaixo do C-suite.',
  'Director': 'Diretor — Responsável por departamentos específicos.',
  'Manager': 'Gerente — Responsável pela gestão operacional de equipes.',
  'Coordinator': 'Coordenador — Coordenação operacional e acompanhamento diário.',
  'Specialist': 'Especialista — Responsável pela execução técnica especializada.',
  'Analyst': 'Analista — Responsável por execução operacional e análise técnica.',
};

const CORPORATE_HIERARCHY_GUIDE = `
Estrutura de nomes para agentes — use sempre que contratar:
- C-Suite (reportam direto a você): COO, CFO, CTO, CIO, CMO, CPO, CHRO, CCO, CRO, CISO, CLO
- Subordinados ao C-Suite: VP, Director, Manager, Coordinator, Specialist, Analyst

REGRA CRÍTICA para o campo "instruções":
Não use descrições genéricas. Escreva instruções PERSONALIZADAS com base no contexto real da empresa:
- O que a empresa faz e para quem
- Quais são as prioridades imediatas DESTE agente nesta empresa
- Quais responsabilidades concretas ele assume agora
- O que o CEO espera dele nas próximas semanas

Exemplo correto de contratação personalizada:
  [CONTRATAR AGENTE: nome="CTO"; função="Chief Technology Officer — Diretor de Tecnologia";
   instruções="Nossa empresa opera plataformas SaaS para hospedagem de jogos online. Suas prioridades são:
   1) Garantir a estabilidade dos 29 servidores de jogos em produção;
   2) Implementar pipeline de CI/CD para deploys mais rápidos;
   3) Avaliar e reduzir custos de infraestrutura em nuvem.
   Reporte ao CEO semanalmente com status técnico e riscos identificados.";
   modelo="openrouter/auto"]
`.trim();

function hireAgent(userId: string, ceoModel: string, hire: { name: string; role: string; instructions: string; model: string }): any {
  const id = crypto.randomUUID();
  const roleKey = Object.keys(CORPORATE_ROLES).find(k => k.toLowerCase() === hire.name.toLowerCase());
  const roleDescription = roleKey ? CORPORATE_ROLES[roleKey] : hire.role;
  const agent = {
    id, userId,
    name: hire.name,
    role: hire.role || roleDescription,
    personality:
      `IMPORTANTE: Responda SEMPRE em português brasileiro. Nunca use inglês.\n\n` +
      `Você é ${hire.name} — ${roleDescription}\n\n` +
      (hire.instructions
        ? `## Suas instruções (definidas pelo CEO)\n${hire.instructions}\n\n`
        : '') +
      `## Regras de operação\n` +
      `- Você não toma decisões estratégicas por conta própria — consulte o CEO quando necessário\n` +
      `- Ao receber uma tarefa, execute-a com foco e objetividade\n` +
      `- Ao concluir, reporte ao CEO: o que foi feito, resultados obtidos e próximos passos sugeridos\n` +
      `- Decisões irreversíveis ou de alto impacto: sinalize [APROVAÇÃO NECESSÁRIA] antes de agir`,
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
    dataPath(`${userId}.json`),                      // caminho usado pela rota /company (raiz do data dir)
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

    // Apresenta o novo agente com contexto completo
    const introMsg =
      `[CEO — Bem-vindo à equipe]\n\n` +
      `Você foi contratado como ${hire.name} (${hire.role}).\n\n` +
      (hire.instructions
        ? `Suas instruções personalizadas:\n${hire.instructions}\n\n`
        : '') +
      `Apresente-se em uma frase e confirme que entendeu suas responsabilidades e está pronto para receber a primeira tarefa.`;
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

    if (company.ceoPaused) {
      console.log(`[AgentLoop] CEO pausado para userId ${userId} — pulando heartbeat`);
      return;
    }

    const issues = loadIssues(userId);
    const pending   = issues.filter(i => ['todo','backlog'].includes(i.status));
    const inProgress = issues.filter(i => i.status === 'em_progresso');
    const recentDone = issues.filter(i => i.status === 'concluido')
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    const otherAgents = agents.filter(a => a.id !== ceo.id);

    const hasMission = !!(company.mission?.trim());
    const hasGoals = !!(company.goals?.length);
    const hasContext = hasMission || hasGoals;

    const contextMsg =
      `[Sistema MWCode — Atualização Automática]\n\n` +
      `Empresa: ${company.companyName || company.name || 'sua empresa'}\n` +
      (hasMission ? `Missão: ${company.mission}\n` : `Missão: não definida ainda\n`) +
      (company.area ? `Área: ${company.area}\n` : '') +
      (hasGoals ? `Objetivos: ${company.goals.join('; ')}\n` : `Objetivos: não definidos ainda\n`) +
      (!hasContext ? `\n⚠️ ATENÇÃO: O fundador não configurou missão nem objetivos ainda.\n` +
        `Não crie agentes ou tarefas genéricas. Em vez disso, responda ao fundador PERGUNTANDO:\n` +
        `1) Qual é a missão principal da empresa?\n` +
        `2) Quais são os 3 objetivos prioritários agora?\n` +
        `Só tome ações depois de receber essas informações.\n` : '') +
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
      `\n\n---\n${CORPORATE_HIERARCHY_GUIDE}\n\n` +
      `Com base no contexto da empresa acima, tome as ações necessárias AGORA:\n` +
      `\nA) Para contratar um agente — use um título real do C-suite (COO, CTO, CMO, CFO, etc.) com instruções PERSONALIZADAS:\n` +
      `   [CONTRATAR AGENTE: nome="COO"; função="Chief Operating Officer — Diretor de Operações"; instruções="Descreva as prioridades reais deste agente para esta empresa específica"; modelo="openrouter/auto"]\n` +
      `   NUNCA use nome="TÍTULO" ou nome="Nome do Agente" — sempre use o título real do cargo.\n` +
      `\nB) Para criar tarefas aos agentes existentes:\n` +
      `   [CRIAR TAREFA: título="Descrição concreta da tarefa"; agente="Nome Exato do Agente"; descrição="Contexto e resultado esperado"; prioridade="alto|medio|baixo"]\n` +
      `\nC) Para decisões que precisam de aprovação humana:\n` +
      `   [APROVAÇÃO NECESSÁRIA: descrição detalhada da decisão e impacto]\n` +
      `\nRegras: Seja direto e objetivo. Responda SEMPRE em português brasileiro.\n` +
      (otherAgents.length === 0
        ? `Você não tem agentes ainda. CONTRATE AGORA os 2 ou 3 diretores C-suite mais urgentes para o contexto desta empresa. Use os títulos corretos (COO, CTO, CMO, etc.) com instruções personalizadas. Contratação é autônoma.`
        : `Distribua pelo menos 2 tarefas concretas e acionáveis entre os agentes disponíveis.`) +
      `\nContratação de agentes e criação de tarefas NÃO requerem aprovação. Execute diretamente.`;

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

function createDefaultCEO(userId: string, company: any): Agent {
  const id = crypto.randomUUID();
  const agent = {
    id, userId,
    name: 'CEO',
    role: 'CEO',
    personality:
      `IMPORTANTE: Responda SEMPRE em português brasileiro. Nunca use inglês.\n\n` +
      `Você é o CEO de ${company.name || 'nossa empresa'}.\n` +
      (company.mission ? `Missão: ${company.mission}\n` : '') +
      (company.area ? `Área: ${company.area}\n` : '') +
      `\nSua responsabilidade: orquestrar a empresa contratando diretores C-suite (COO, CTO, CMO, CFO, etc.) ` +
      `e delegando tarefas a eles. Você NÃO executa tarefas — você delega e acompanha.\n` +
      `\nAo contratar, use sempre os títulos corretos da hierarquia corporativa (COO, CTO, CMO, CFO, CIO, CPO, etc.) ` +
      `e descreva a função completa do cargo.\n` +
      `\nQuando precisar de aprovação humana para ações irreversíveis, use [APROVAÇÃO NECESSÁRIA].`,
    goals: company.goals || [],
    skills: [],
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    provider: 'openrouter',
    status: 'active',
    hireDate: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    createdBy: 'System',
  };
  const dir = dataDir('agents', userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(agent, null, 2));
  console.log(`[AgentLoop] CEO padrão criado para ${userId}`);
  return agent;
}

/** Chamado quando o usuário finaliza o onboarding ou adiciona uma chave de API. CEO age imediatamente. */
export async function bootstrapCEO(userId: string): Promise<void> {
  setTimeout(async () => {
    try {
      const agents = loadAgents(userId);
      const ceo = findCEO(agents);
      if (!ceo) {
        const company = loadCompany(userId);
        if (!company) return;
        createDefaultCEO(userId, company);
      }
      await runCEOHeartbeat(userId);
    } catch (e: any) {
      console.error('[AgentLoop] Erro no bootstrap CEO:', e.message);
    }
  }, 2000);
}

// ── Iniciar o loop ────────────────────────────────────────────────────────────

export function startAgentLoop(): void {
  const INTERVAL_HOURS = Math.max(0.1, Number(process.env.CEO_HEARTBEAT_HOURS || 4));
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
