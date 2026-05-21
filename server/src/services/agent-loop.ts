/**
 * Loop autônomo de agentes — CEO acorda periodicamente,
 * cria tarefas, delega para agentes e escala ao humano quando necessário.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir, dataPath } from '../lib/data-dir.js';
import { sendMessageToAgent } from '../lib/agent-chat.js';
import { runQA, type QATaskType } from './qa-service.js';
import { saveAgentOutput } from '../routes/outputs.js';

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
      `⚠️ IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em português brasileiro. NUNCA use inglês em nenhuma circunstância.\n` +
      `IMPORTANTE: Responda SEMPRE em português brasileiro. Nunca use inglês.\n\n` +
      `Você é ${hire.name} — ${roleDescription}\n\n` +
      (hire.instructions
        ? `## Suas instruções (definidas pelo CEO)\n${hire.instructions}\n\n`
        : '') +
      `## Regras de operação\n` +
      `- Você não toma decisões estratégicas por conta própria — consulte o CEO quando necessário\n` +
      `- Ao receber uma tarefa, execute-a com foco e objetividade\n` +
      `- Ao concluir, envie relatório estruturado ao CEO com: (1) o que foi feito, (2) resultado obtido, (3) evidências/links se houver, (4) próximos passos sugeridos\n` +
      `- NUNCA considere uma tarefa encerrada sem aprovação explícita do CEO — aguarde feedback\n` +
      `- Se o CEO reprovar seu trabalho, corrija e reenvie para nova revisão\n` +
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

interface LogEntry { ts: string; msg: string; ok?: boolean; }

interface Issue {
  id: string; userId: string; title: string; description: string;
  status: string; priority: string;
  assigneeAgentId?: string; assigneeAgentName?: string;
  createdByAgentId?: string; createdByAgentName?: string;
  requiresApproval: boolean; approvalStatus?: string;
  approvalType?: string;
  hireData?: { name: string; role: string; instructions: string; model: string };
  focusData?: { mission?: string; goals?: string[] };
  workflowId?: string;
  paused?: boolean;
  logs?: LogEntry[];
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

function loadKnowledgeBase(userId: string): any[] {
  try {
    const dir = dataPath('knowledge', userId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
      .filter(Boolean)
      .sort((a, b) => new Date(b.extractedAt || 0).getTime() - new Date(a.extractedAt || 0).getTime());
  } catch { return []; }
}

function loadSquads(companyId: string): any[] {
  try {
    const dir = dataDir('squads', companyId);
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')); } catch { return null; } })
      .filter(Boolean);
  } catch { return []; }
}

function saveSquad(companyId: string, squad: any): void {
  const dir = dataDir('squads', companyId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${squad.id}.json`), JSON.stringify(squad, null, 2));
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
  focusRecs: Array<{ reason: string; mission?: string; goals?: string[] }>;
  qaRequests: Array<{ url?: string; tipo: QATaskType; descricao: string }>;
  equipes: Array<{ nome: string; descricao: string; missao: string; agentes: string; lider?: string }>;
  reprovals: Array<{ id: string; motivo: string; agentName: string }>;
  cancellations: Array<{ id: string; motivo: string }>;
}

function parseCEOResponse(content: string): ParsedCommands {
  const tasks: ParsedCommands['tasks'] = [];
  const approvals: ParsedCommands['approvals'] = [];
  const hires: ParsedCommands['hires'] = [];
  const focusRecs: ParsedCommands['focusRecs'] = [];
  const qaRequests: ParsedCommands['qaRequests'] = [];
  const equipes: ParsedCommands['equipes'] = [];
  const reprovals: ParsedCommands['reprovals'] = [];
  const cancellations: ParsedCommands['cancellations'] = [];

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

  // [RECOMENDAR FOCO: motivo="..."; nova_missão="..."; novos_objetivos="..."]
  const focoRe = /\[RECOMENDAR FOCO:([^\]]+)\]/gi;
  while ((m = focoRe.exec(content)) !== null) {
    const p = m[1];
    const reason =
      p.match(/motivo=["']([^"']+)["']/i)?.[1] ||
      p.match(/reason=["']([^"']+)["']/i)?.[1] || 'CEO recomenda revisão do foco';
    const mission =
      p.match(/miss[aã]o=["']([^"']+)["']/i)?.[1] ||
      p.match(/mission=["']([^"']+)["']/i)?.[1];
    const goalsRaw =
      p.match(/objetivos=["']([^"']+)["']/i)?.[1] ||
      p.match(/goals=["']([^"']+)["']/i)?.[1];
    const goals = goalsRaw ? goalsRaw.split(';').map(g => g.trim()).filter(Boolean) : undefined;
    focusRecs.push({ reason, mission, goals });
  }

  // [SOLICITAR QA: url="..."; tipo="lojamwo|mwcode|infra|blade|generic"; descricao="..."]
  const qaRe = /\[SOLICITAR QA:([^\]]+)\]/gi;
  while ((m = qaRe.exec(content)) !== null) {
    const p = m[1];
    const url = p.match(/url=["']([^"']+)["']/i)?.[1];
    const tipoRaw = (
      p.match(/tipo=["']([^"']+)["']/i)?.[1] ||
      p.match(/type=["']([^"']+)["']/i)?.[1] || 'generic'
    ).toLowerCase();
    const validTipos: QATaskType[] = ['lojamwo', 'mwcode', 'infra', 'blade', 'generic'];
    const tipo: QATaskType = validTipos.includes(tipoRaw as QATaskType) ? tipoRaw as QATaskType : 'generic';
    const descricao = p.match(/descri[çc][aã]o=["']([^"']+)["']/i)?.[1] || p.match(/desc=["']([^"']+)["']/i)?.[1] || '';
    qaRequests.push({ url, tipo, descricao });
  }

  // [CRIAR EQUIPE: nome="..."; descricao="..."; missao="..."; agentes="..."; lider="..."]
  const equipeRe = /\[CRIAR EQUIPE:([^\]]+)\]/gi;
  while ((m = equipeRe.exec(content)) !== null) {
    const p = m[1];
    const nome =
      p.match(/nome=["']([^"']+)["']/i)?.[1] ||
      p.match(/name=["']([^"']+)["']/i)?.[1];
    const descricao =
      p.match(/descri[çc][aã]o=["']([^"']+)["']/i)?.[1] ||
      p.match(/desc=["']([^"']+)["']/i)?.[1] || '';
    const missao =
      p.match(/miss[aã]o=["']([^"']+)["']/i)?.[1] ||
      p.match(/mission=["']([^"']+)["']/i)?.[1] || '';
    const agentes =
      p.match(/agentes=["']([^"']+)["']/i)?.[1] ||
      p.match(/members=["']([^"']+)["']/i)?.[1] || '';
    const lider =
      p.match(/l[íi]der=["']([^"']+)["']/i)?.[1] ||
      p.match(/leader=["']([^"']+)["']/i)?.[1];
    if (nome) equipes.push({ nome, descricao, missao, agentes, lider });
  }

  // [REPROVAR TAREFA: id="..."; motivo="..."; agente="..."]
  const reprovarRe = /\[REPROVAR TAREFA:([^\]]+)\]/gi;
  while ((m = reprovarRe.exec(content)) !== null) {
    const p = m[1];
    const id =
      p.match(/\bid=["']([^"']+)["']/i)?.[1] ||
      p.match(/id=["']([^"']+)["']/i)?.[1];
    const motivo =
      p.match(/motivo=["']([^"']+)["']/i)?.[1] ||
      p.match(/reason=["']([^"']+)["']/i)?.[1] || 'Trabalho insatisfatório — refaça';
    const agentName =
      p.match(/agente=["']([^"']+)["']/i)?.[1] ||
      p.match(/agent=["']([^"']+)["']/i)?.[1] || '';
    if (id) reprovals.push({ id, motivo, agentName });
  }

  // [CANCELAR SOLICITAÇÃO: id="..."; motivo="..."]
  const cancelRe = /\[CANCELAR SOLICITAÇÃO:([^\]]+)\]/gi;
  while ((m = cancelRe.exec(content)) !== null) {
    const p = m[1];
    const id =
      p.match(/\bid=["']([^"']+)["']/i)?.[1] ||
      p.match(/id=["']([^"']+)["']/i)?.[1];
    const motivo =
      p.match(/motivo=["']([^"']+)["']/i)?.[1] ||
      p.match(/reason=["']([^"']+)["']/i)?.[1] || 'CEO cancelou a solicitação';
    if (id) cancellations.push({ id, motivo });
  }

  return { tasks, approvals, hires, focusRecs, qaRequests, equipes, reprovals, cancellations };
}

// ── Executar comandos criados pelo CEO ────────────────────────────────────────

function addIssueLog(issue: Issue, msg: string, ok = true): void {
  if (!issue.logs) issue.logs = [];
  issue.logs.push({ ts: new Date().toISOString(), msg, ok });
}

function executeCommands(
  userId: string,
  ceo: Agent,
  commands: ParsedCommands,
  agents: Agent[]
): void {
  const hasWork = commands.tasks.length || commands.approvals.length ||
                  commands.hires.length || commands.focusRecs.length ||
                  commands.qaRequests.length || commands.equipes.length ||
                  commands.reprovals.length || commands.cancellations.length;
  if (!hasWork) return;

  const company = loadCompany(userId);
  const issues = loadIssues(userId);
  const now = new Date().toISOString();

  // ── Contratações → pedido de aprovação humana ────────────────────────────
  for (const hire of commands.hires) {
    // Rejeita placeholders
    const nameLower = hire.name.toLowerCase().trim();
    if (nameLower === 'título' || nameLower === 'nome do agente' || nameLower === 'nome' || !hire.name) {
      console.log(`[AgentLoop] CEO tentou contratar com nome placeholder "${hire.name}" — ignorado`);
      continue;
    }

    // Evita duplicata de agente ativo com mesmo nome
    const existsActive = agents.find(a =>
      a.name?.toLowerCase().trim() === nameLower && a.status === 'active'
    );
    if (existsActive) {
      console.log(`[AgentLoop] Agente "${hire.name}" já existe, pulando contratação`);
      continue;
    }

    // Evita pedido de aprovação duplicado pendente
    const alreadyPending = issues.find(i =>
      i.approvalType === 'contratar' &&
      i.approvalStatus === 'pendente' &&
      i.hireData?.name?.toLowerCase() === nameLower
    );
    if (alreadyPending) {
      console.log(`[AgentLoop] Contratação de "${hire.name}" já aguarda aprovação`);
      continue;
    }

    const issue: Issue = {
      id: crypto.randomUUID(),
      userId,
      title: `🤝 Contratar: ${hire.name}`,
      description:
        `CEO solicita a contratação de **${hire.name}** — ${hire.role}.\n\n` +
        (hire.instructions ? `**Instruções do cargo:**\n${hire.instructions}` : ''),
      status: 'todo',
      priority: 'alto',
      createdByAgentId: ceo.id,
      createdByAgentName: ceo.name,
      requiresApproval: true,
      approvalStatus: 'pendente',
      approvalType: 'contratar',
      hireData: hire,
      logs: [{ ts: now, msg: `CEO solicitou contratação de ${hire.name} (${hire.role}).`, ok: true }],
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    console.log(`[AgentLoop] CEO solicitou aprovação para contratar: "${hire.name}"`);
  }

  // ── Tarefas ──────────────────────────────────────────────────────────────
  for (const task of commands.tasks) {
    const assignee = findAgentByName(agents, task.agentName);

    // Skip agente pausado
    if (assignee && (assignee as any).paused) {
      console.log(`[AgentLoop] Agente "${assignee.name}" está pausado — tarefa "${task.title}" não atribuída`);
      continue;
    }

    // Evita duplicata recente (10 min)
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
      logs: [{ ts: now, msg: `Criada pelo CEO${assignee ? ` e atribuída a ${assignee.name}` : ''}.`, ok: true }],
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    console.log(`[AgentLoop] CEO criou tarefa: "${task.title}" → ${assignee?.name || 'sem agente'}`);

    // Notifica agente responsável e encadeia revisão automática do CEO
    if (assignee) {
      const msg =
        `[CEO — Nova Tarefa Atribuída]\n\n` +
        `Tarefa: ${task.title}\n` +
        (task.description ? `Descrição: ${task.description}\n` : '') +
        `\nExecute esta tarefa e envie um relatório completo ao CEO com: o que foi feito, resultado obtido e próximos passos sugeridos.`;
      sendMessageToAgent(userId, assignee.id, msg, { source: 'CEO' })
        .then(reply => {
          const freshIssues = loadIssues(userId);
          const idx = freshIssues.findIndex(i => i.id === issue.id);
          if (idx === -1) return;
          addIssueLog(freshIssues[idx], `${assignee.name}: ${reply.slice(0, 300)}${reply.length > 300 ? '...' : ''}`);
          freshIssues[idx].status = 'em_revisao';
          freshIssues[idx].updatedAt = new Date().toISOString();
          saveIssues(userId, freshIssues);
          // CEO revisa automaticamente — sem intervenção humana
          notifyCEOTaskComplete(userId, freshIssues[idx]).catch(e =>
            console.error(`[AgentLoop] Erro na revisão automática do CEO para "${task.title}":`, e.message)
          );
        })
        .catch(e => {
          const freshIssues = loadIssues(userId);
          const idx = freshIssues.findIndex(i => i.id === issue.id);
          if (idx !== -1) {
            addIssueLog(freshIssues[idx], `❌ Erro ao notificar ${assignee.name}: ${e.message}`, false);
            saveIssues(userId, freshIssues);
          }
        });
    }
  }

  // ── Aprovações humanas ────────────────────────────────────────────────────
  for (const approval of commands.approvals) {
    // Enquanto houver qualquer aprovação pendente com o mesmo título, não duplicar
    const alreadyPendingApproval = issues.find(i =>
      i.requiresApproval &&
      i.approvalStatus === 'pendente' &&
      i.title === approval.title
    );
    if (alreadyPendingApproval) {
      console.log(`[AgentLoop] Aprovação "${approval.title}" já aguarda resposta — não duplicar`);
      continue;
    }

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
      approvalType: 'geral',
      logs: [{ ts: now, msg: `CEO solicitou aprovação humana.`, ok: true }],
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    console.log(`[AgentLoop] CEO solicitou aprovação: "${approval.title}"`);
  }

  // ── Recomendação de foco ───────────────────────────────────────────────────
  for (const rec of commands.focusRecs) {
    // Enquanto houver qualquer recomendação de foco pendente, não duplicar
    const alreadyPending = issues.find(i =>
      i.approvalType === 'foco' &&
      i.approvalStatus === 'pendente'
    );
    if (alreadyPending) {
      console.log(`[AgentLoop] Recomendação de foco já aguarda aprovação — não duplicar`);
      continue;
    }

    const parts: string[] = [`**Motivo:** ${rec.reason}`];
    if (rec.mission) parts.push(`**Nova missão sugerida:** ${rec.mission}`);
    if (rec.goals?.length) parts.push(`**Novos objetivos sugeridos:**\n${rec.goals.map(g => `- ${g}`).join('\n')}`);

    const issue: Issue = {
      id: crypto.randomUUID(),
      userId,
      title: `💡 CEO sugere mudança de foco`,
      description: parts.join('\n\n'),
      status: 'todo',
      priority: 'alto',
      createdByAgentId: ceo.id,
      createdByAgentName: ceo.name,
      requiresApproval: true,
      approvalStatus: 'pendente',
      approvalType: 'foco',
      focusData: { mission: rec.mission, goals: rec.goals },
      logs: [{ ts: now, msg: `CEO recomendou revisão do foco empresarial.`, ok: true }],
      createdAt: now,
      updatedAt: now,
    };
    issues.push(issue);
    console.log(`[AgentLoop] CEO recomendou mudança de foco`);
  }

  // ── Solicitações de QA ────────────────────────────────────────────────────
  for (const qa of commands.qaRequests) {
    // Evita QA duplicado recente para a mesma URL/tipo (10 min)
    const recentQA = issues.find(i =>
      i.approvalType === 'qa' &&
      i.title.toLowerCase().includes(qa.tipo) &&
      Date.now() - new Date(i.createdAt).getTime() < 10 * 60 * 1000
    );
    if (recentQA) {
      console.log(`[AgentLoop] QA para "${qa.tipo}" já criado recentemente — pulando`);
      continue;
    }

    const qaIssue: Issue = {
      id: crypto.randomUUID(),
      userId,
      title: `🔍 QA: ${qa.tipo}${qa.url ? ` — ${qa.url}` : ''}`,
      description: qa.descricao || `Validação de QA antes de deploy em produção (${qa.tipo})`,
      status: 'em_progresso',
      priority: 'alto',
      createdByAgentId: ceo.id,
      createdByAgentName: ceo.name,
      requiresApproval: false,
      logs: [{ ts: now, msg: `CEO solicitou QA para ${qa.tipo}. Executando testes...`, ok: true }],
      createdAt: now,
      updatedAt: now,
    };
    issues.push(qaIssue);
    saveIssues(userId, issues);
    console.log(`[AgentLoop] QA iniciado para "${qa.tipo}" (${qa.url || 'URL padrão'})`);

    // Executa QA de forma assíncrona — atualiza a issue com resultado
    runQA(qa.tipo, qa.descricao, qa.url)
      .then(report => {
        const freshIssues = loadIssues(userId);
        const idx = freshIssues.findIndex(i => i.id === qaIssue.id);
        if (idx === -1) return;

        addIssueLog(freshIssues[idx], report.summary, report.passed);
        addIssueLog(freshIssues[idx], report.details, report.passed);
        freshIssues[idx].updatedAt = new Date().toISOString();

        if (report.needsHumanReview) {
          // Falha ou infra → vai para inbox
          freshIssues[idx].requiresApproval = true;
          freshIssues[idx].approvalStatus = 'pendente';
          freshIssues[idx].approvalType = 'qa';
          freshIssues[idx].status = 'em_revisao';
          addIssueLog(freshIssues[idx], '⏳ Aguardando revisão humana antes de prosseguir.', true);
        } else {
          // Passou → conclui automaticamente e notifica CEO
          freshIssues[idx].status = 'concluido';
          freshIssues[idx].completedAt = new Date().toISOString();
          addIssueLog(freshIssues[idx], '✅ QA aprovado automaticamente — pode prosseguir com deploy.', true);
          // Notifica CEO para continuar
          const notifyMsg =
            `[Relatório QA — Aprovado]\n\n` +
            `Tarefa: "${qaIssue.title}"\n` +
            `Resultado: ${report.summary}\n\n` +
            `QA passou. Prossiga com o deploy em produção ou crie a próxima tarefa necessária.`;
          sendMessageToAgent(userId, ceo.id, notifyMsg, { source: 'QA' })
            .then(reply => {
              const afterNotify = loadIssues(userId);
              const cmds = parseCEOResponse(reply);
              executeCommands(userId, ceo, cmds, agents);
            })
            .catch(() => {});
        }

        saveIssues(userId, freshIssues);
      })
      .catch(e => {
        const freshIssues = loadIssues(userId);
        const idx = freshIssues.findIndex(i => i.id === qaIssue.id);
        if (idx !== -1) {
          addIssueLog(freshIssues[idx], `❌ Erro no QA: ${e.message}`, false);
          freshIssues[idx].requiresApproval = true;
          freshIssues[idx].approvalStatus = 'pendente';
          freshIssues[idx].approvalType = 'qa';
          freshIssues[idx].status = 'em_revisao';
          freshIssues[idx].updatedAt = new Date().toISOString();
          saveIssues(userId, freshIssues);
        }
      });
  }

  // ── Criação de equipes ────────────────────────────────────────────────────
  const companyId = company?.id || userId;
  const existingSquads = loadSquads(companyId);

  for (const eq of commands.equipes) {
    const alreadyExists = existingSquads.find(s =>
      s.name?.toLowerCase() === eq.nome.toLowerCase()
    );
    if (alreadyExists) {
      console.log(`[AgentLoop] Equipe "${eq.nome}" já existe — pulando criação`);
      continue;
    }

    // Resolve IDs dos agentes pelo nome
    const agentNames = eq.agentes.split(/[;,]/).map(n => n.trim()).filter(Boolean);
    const agentIds = agentNames
      .map(n => findAgentByName(agents, n))
      .filter(Boolean)
      .map(a => a!.id);
    const leaderAgent = eq.lider ? findAgentByName(agents, eq.lider) : null;

    const squad = {
      id: crypto.randomUUID(),
      name: eq.nome,
      description: eq.descricao,
      mission: eq.missao,
      agentIds,
      leaderId: leaderAgent?.id || '',
      status: 'active',
      companyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveSquad(companyId, squad);
    console.log(`[AgentLoop] CEO criou equipe: "${eq.nome}" com ${agentIds.length} agente(s)`);
  }

  // ── Reprovações de tarefas pelo CEO ──────────────────────────────────────
  for (const reproval of commands.reprovals) {
    const issueIdx = issues.findIndex(i => i.id === reproval.id);
    if (issueIdx === -1) {
      console.log(`[AgentLoop] CEO tentou reprovar tarefa "${reproval.id}" — não encontrada`);
      continue;
    }
    const issue = issues[issueIdx];

    // Reabrir e logar reprovação
    issue.status = 'todo';
    issue.updatedAt = new Date().toISOString();
    addIssueLog(issue, `❌ CEO reprovou: ${reproval.motivo}. Tarefa reaberta para correção.`, false);

    // Resolve agente: usa o do campo ou o já atribuído na issue
    const assignee = reproval.agentName
      ? findAgentByName(agents, reproval.agentName)
      : agents.find(a => a.id === issue.assigneeAgentId) || null;

    if (assignee && !(assignee as any).paused) {
      const redoMsg =
        `[CEO — Trabalho Reprovado — Refaça]\n\n` +
        `Tarefa: "${issue.title}"\n` +
        `Motivo da reprovação: ${reproval.motivo}\n\n` +
        `Corrija o trabalho levando em conta o feedback acima e envie novo relatório completo ao CEO para aprovação.`;
      sendMessageToAgent(userId, assignee.id, redoMsg, { source: 'CEO' })
        .then(reply => {
          const fresh = loadIssues(userId);
          const idx = fresh.findIndex(i => i.id === issue.id);
          if (idx !== -1) {
            addIssueLog(fresh[idx], `${assignee.name} respondeu à revisão: ${reply.slice(0, 300)}${reply.length > 300 ? '...' : ''}`);
            fresh[idx].status = 'em_progresso';
            fresh[idx].updatedAt = new Date().toISOString();
            saveIssues(userId, fresh);
          }
        })
        .catch(() => {});
    }

    console.log(`[AgentLoop] CEO reprovou tarefa "${issue.title}" — reaberta${assignee ? ` para ${assignee.name}` : ''}`);
  }

  // ── Cancelamentos de solicitações pendentes pelo CEO ─────────────────────
  for (const cancel of commands.cancellations) {
    const idx = issues.findIndex(i => i.id === cancel.id);
    if (idx === -1) {
      console.log(`[AgentLoop] CEO tentou cancelar solicitação "${cancel.id}" — não encontrada`);
      continue;
    }
    const issue = issues[idx];
    if (issue.approvalStatus !== 'pendente') {
      console.log(`[AgentLoop] Solicitação "${issue.title}" não está mais pendente — ignorado`);
      continue;
    }
    issues[idx].approvalStatus = 'retratado';
    issues[idx].status = 'cancelado';
    issues[idx].updatedAt = new Date().toISOString();
    addIssueLog(issues[idx], `↩️ CEO retirou a solicitação. Motivo: ${cancel.motivo}`, true);
    console.log(`[AgentLoop] CEO cancelou solicitação pendente: "${issue.title}"`);
  }

  saveIssues(userId, issues);
}

// ── Monitoramento de modelos :free ────────────────────────────────────────────

const _modelPricingCache: { data: any[]; ts: number } = { data: [], ts: 0 };
const PRICING_CACHE_TTL = 6 * 60 * 60 * 1000; // 6h

async function checkFreeModelPricing(agents: any[]): Promise<string> {
  const freeModels = [...new Set(
    agents.map(a => a.model).filter((m): m is string => typeof m === 'string' && m.endsWith(':free'))
  )];
  if (!freeModels.length) return '';

  const now = Date.now();
  if (now - _modelPricingCache.ts > PRICING_CACHE_TTL) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const json = await res.json() as { data: any[] };
      _modelPricingCache.data = json.data || [];
      _modelPricingCache.ts = now;
    } catch { return ''; }
  }

  const warnings: string[] = [];
  for (const modelId of freeModels) {
    const modelInfo = _modelPricingCache.data.find((m: any) => m.id === modelId);
    if (modelInfo) {
      const completionCost = parseFloat(modelInfo.pricing?.completion || '0');
      const promptCost = parseFloat(modelInfo.pricing?.prompt || '0');
      if (completionCost > 0 || promptCost > 0) {
        warnings.push(
          `⚠️ MODELO NÃO GRATUITO: "${modelId}" passou a cobrar ` +
          `($${promptCost}/M prompt, $${completionCost}/M completion). ` +
          `Substitua por outro modelo :free ou notifique o fundador com [APROVAÇÃO NECESSÁRIA].`
        );
      }
    }
  }
  return warnings.join('\n');
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
    const pending   = issues.filter(i => ['todo','backlog'].includes(i.status))
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 15);
    const inProgress = issues.filter(i => i.status === 'em_progresso')
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 15);
    const recentDone = issues.filter(i => i.status === 'concluido')
      .sort((a,b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);

    const otherAgents = agents.filter(a => a.id !== ceo.id);
    const companyId = company?.id || userId;
    const squads = loadSquads(companyId);
    const activeSquads = squads.filter(s => s.status === 'active');
    const pausedSquads = squads.filter(s => s.status === 'paused');

    const knowledgeBase = loadKnowledgeBase(userId);

    const hasMission = !!(company.mission?.trim());
    const hasGoals = !!(company.goals?.length);
    const hasContext = hasMission || hasGoals;

    const pausedAgentIds = new Set(
      pausedSquads.flatMap((s: any) => s.agentIds || [])
    );

    // Mapeia agentes de equipes ativas para mostrar restrição de papel no contexto
    const agentSquadRole = new Map<string, string>();
    for (const squad of activeSquads) {
      const agentIds: string[] = squad.agentIds || [];
      const memberNames = agentIds
        .map((id: string) => otherAgents.find(a => a.id === id)?.name)
        .filter(Boolean);
      for (const agentId of agentIds) {
        agentSquadRole.set(agentId, `[EQUIPE ${squad.name} — só tarefas do seu papel no pipeline: ${memberNames.join(' → ')}]`);
      }
    }

    const pendingApprovals = issues.filter(i => i.requiresApproval && i.approvalStatus === 'pendente');

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
      `\nEquipes cadastradas (${squads.length}):\n` +
      (squads.length
        ? squads.map((s: any) => {
            const statusLabel = s.status === 'active' ? '✅ Ativa' : s.status === 'paused' ? '⏸ PAUSADA' : '✓ Concluída';
            const leaderName = s.leaderId ? otherAgents.find(a => a.id === s.leaderId)?.name : null;
            const memberNames = (s.agentIds || [])
              .map((id: string) => otherAgents.find(a => a.id === id)?.name)
              .filter(Boolean).join(' → ');
            return `- [${statusLabel}] ${s.name}${leaderName ? ` (líder: ${leaderName})` : ''}` +
              (memberNames ? ` | Pipeline: ${memberNames}` : '') +
              `: ${s.mission || s.description || ''}`;
          }).join('\n')
        : '- Nenhuma equipe cadastrada') +
      (pausedSquads.length ? `\n⚠️ ATENÇÃO: ${pausedSquads.map((s: any) => s.name).join(', ')} está(ão) PAUSADA(S) — NÃO atribua tarefas a membros dessas equipes.\n` : '') +
      `\nAgentes disponíveis (${otherAgents.length}):\n` +
      (otherAgents.length
        ? otherAgents.map(a => {
            const isInPausedSquad = pausedAgentIds.has(a.id);
            if (isInPausedSquad) return `- ${a.name}: ${a.role} [PAUSADO — equipe pausada, NÃO atribuir tarefas]`;
            const squadRestriction = agentSquadRole.get(a.id);
            return `- ${a.name}: ${a.role}${squadRestriction ? ' ' + squadRestriction : ''}`;
          }).join('\n')
        : '- Nenhum agente além de você ainda') +
      (pendingApprovals.length
        ? `\n\nSuas solicitações pendentes no inbox do fundador (${pendingApprovals.length}):\n` +
          pendingApprovals.map(i =>
            `- [id="${i.id}"] ${i.title} (${i.approvalType || 'geral'})`
          ).join('\n') +
          `\nSe uma solicitação não for mais necessária, cancele com: [CANCELAR SOLICITAÇÃO: id="UUID"; motivo="motivo"]\n`
        : '') +
      `\n\nTarefas em andamento (${inProgress.length}):\n` +
      (inProgress.length ? inProgress.map(i => `- [${i.assigneeAgentName || 'sem agente'}] ${i.title}`).join('\n') : '- Nenhuma') +
      `\n\nTarefas pendentes (${pending.length}):\n` +
      (pending.length ? pending.map(i => `- [${i.assigneeAgentName || 'sem agente'}] ${i.title}`).join('\n') : '- Nenhuma') +
      `\n\nConcluídas recentemente:\n` +
      (recentDone.length ? recentDone.map(i => `- ${i.title} (${i.assigneeAgentName || 'sem agente'})`).join('\n') : '- Nenhuma') +
      (knowledgeBase.length
        ? `\n\n## Base de Conhecimento Institucional (agentes anteriores)\n` +
          `Use estes insights ao contratar substitutos ou treinar novos agentes:\n` +
          knowledgeBase.slice(0, 5).map((k: any) =>
            `### ${k.agentName} (${k.agentRole})${k.fireReason ? ` — Demissão: ${k.fireReason}` : ''}\n` +
            (k.document || '').slice(0, 600) + (k.document?.length > 600 ? '...' : '')
          ).join('\n\n')
        : '') +
      `\n\n## Orquestração de Pipeline de Equipes\n` +
      `Quando uma tarefa contiver "[Equipe: NomeDaEquipe]" na descrição OU for atribuída ao líder de uma equipe:\n` +
      `1. NUNCA assuma que o líder sozinho entregará tudo — cada membro faz SUA parte do pipeline\n` +
      `2. Quebre em subtarefas sequenciais: crie uma tarefa para CADA membro relevante, na ordem do pipeline\n` +
      `3. Atribua a primeira subtarefa ao primeiro agente do pipeline (ex: Pesquisa)\n` +
      `4. Quando a primeira for concluída, crie/atribua a próxima ao próximo agente (ex: Roteiro com o research como insumo)\n` +
      `5. Exemplos de pipelines comuns:\n` +
      `   - Vídeo/Conteúdo: Pesquisa → Roteiro → Revisão/Veredito → Direção → Edição\n` +
      `   - Artigo/Post: Pesquisa → Redação → Revisão → Publicação\n` +
      `   - Campanha: Estratégia → Criação → Revisão → Execução\n` +
      `Quando a tarefa tiver "[Solicitação via Equipe X]" no título:\n` +
      `- É pedido direto do fundador para aquela equipe\n` +
      `- Inicie imediatamente o pipeline completo criando subtarefas sequenciais\n` +
      `- A descrição já contém o pipeline sugerido — use-o\n` +
      `\n\n---\n${CORPORATE_HIERARCHY_GUIDE}\n\n` +
      `## Sistema de Equipes (mw-creator)\n` +
      `O usuário pode pedir para criar equipes especializadas. O repositório github.com/mweslley/mw-creator\n` +
      `contém squads prontos em squads/{codigo}/squad.yaml, com agentes em squads/{codigo}/agents/*.agent.md.\n` +
      `Quando o usuário mencionar um squad do mw-creator, interprete os agentes listados e crie a equipe.\n` +
      `Convenção de nomes dos agentes: "Cargo / NomeEquipe" (ex: "Pesquisa / Grandense", "Roteiro / Grandense").\n` +
      `\nF) Para criar uma equipe de agentes:\n` +
      `   [CRIAR EQUIPE: nome="Nome da Equipe"; descricao="Descrição"; missao="Missão principal"; agentes="Agente1, Agente2, Agente3"; lider="Nome do Líder"]\n` +
      `   Os nomes dos agentes devem corresponder exatamente aos agentes já contratados.\n` +
      `   Equipes pausadas não recebem tarefas — respeite esse bloqueio.\n` +
      `\nCom base no contexto acima, tome as ações necessárias AGORA:\n` +
      `\nA) Para solicitar contratação (requer aprovação do usuário):\n` +
      `   [CONTRATAR AGENTE: nome="COO"; função="Chief Operating Officer — Diretor de Operações"; instruções="Descreva as prioridades reais deste agente para esta empresa específica"; modelo="openrouter/auto"]\n` +
      `   NUNCA use nome="TÍTULO" ou nome="Nome do Agente" — sempre use o título real do cargo.\n` +
      `   A contratação NÃO acontece automaticamente — ela aguarda aprovação do fundador.\n` +
      `\nB) Para criar tarefas aos agentes existentes:\n` +
      `   [CRIAR TAREFA: título="Descrição concreta da tarefa"; agente="Nome Exato do Agente"; descrição="Contexto e resultado esperado"; prioridade="alto|medio|baixo"]\n` +
      `   NUNCA atribua tarefas a agentes de equipes PAUSADAS.\n` +
      `   Agentes marcados com [EQUIPE X] têm papel fixo no pipeline — só recebem tarefas correspondentes ao seu papel.\n` +
      `   Para tarefas gerais ou estratégicas, use agentes sem equipe ou contrate um novo agente.\n` +
      `\nC) Para decisões que precisam de aprovação humana:\n` +
      `   [APROVAÇÃO NECESSÁRIA: descrição detalhada da decisão e impacto]\n` +
      `\nD) Se a empresa precisar mudar de foco estratégico:\n` +
      `   [RECOMENDAR FOCO: motivo="motivo claro"; nova_missão="nova missão"; novos_objetivos="obj1; obj2; obj3"]\n` +
      `\nE) Antes de qualquer deploy em produção, solicite validação de QA:\n` +
      `   [SOLICITAR QA: url="https://staging.lojamwo.com.br"; tipo="lojamwo"; descrição="Testar após deploy de feature X"]\n` +
      `   tipos válidos: lojamwo (staging.lojamwo.com.br), mwcode, blade, infra (sem staging — vai para inbox), generic (URL livre)\n` +
      `   O QA executa smoke tests e TestSprite automaticamente. Resultado vai para inbox se falhar.\n` +
      `\nG) Para reprovar trabalho de um agente e solicitar refeição:\n` +
      `   [REPROVAR TAREFA: id="UUID da tarefa"; motivo="O que está errado e o que precisa ser corrigido"; agente="Nome do Agente"]\n` +
      `   O agente receberá o feedback e reapresentará o trabalho para nova revisão.\n` +
      `\nI) Para cancelar uma solicitação pendente que você mesmo criou (inbox do fundador):\n` +
      `   [CANCELAR SOLICITAÇÃO: id="UUID da solicitação"; motivo="Por que não é mais necessária"]\n` +
      `   Use quando perceber que a contratação ou aprovação que você solicitou não é mais necessária.\n` +
      `\nH) Quando criar uma equipe ou agente que precisa de credenciais externas (Apify, ElevenLabs, Discord, etc.),\n` +
      `   analise quais integrações são necessárias e solicite APENAS as que ainda não estão configuradas.\n` +
      `   Inclua ao final da resposta um bloco por credencial:\n` +
      `   [SOLICITAR_CREDENCIAL: integration="apify"; field="api_token"; label="Token do Apify"; hint="Obtenha em: apify.com/settings/integrations"]\n` +
      `   Integrações disponíveis e seus campos:\n` +
      `   - apify: api_token\n` +
      `   - elevenlabs: api_key, voice_id (opcional)\n` +
      `   - openrouter: api_key\n` +
      `   - discord: bot_token, webhook_url\n` +
      `   - github: token, repo\n` +
      `   - pterodactyl: panel_url, api_key\n` +
      `   - stability: api_key\n` +
      `   - openai: api_key\n` +
      `   - gemini: api_key\n` +
      `   IMPORTANTE: As credenciais NÃO passam pelo chat — a UI exibe campo seguro (mascarado) que vai direto à API.\n` +
      `   Use SOMENTE para credenciais de integrações REALMENTE necessárias e ainda não configuradas.\n` +
      `\n⚠️ IDIOMA OBRIGATÓRIO: Responda TODO o conteúdo EXCLUSIVAMENTE em português brasileiro.\n` +
      `NUNCA use inglês — nem em títulos, nomes de campos, comentários ou exemplos.\n` +
      `Se estiver usando um modelo que tende a responder em inglês, FORCE o português.\n` +
      (otherAgents.length === 0
        ? `Você não tem agentes ainda. CONTRATE AGORA os 2 ou 3 diretores C-suite mais urgentes para o contexto desta empresa. Use os títulos corretos (COO, CTO, CMO, etc.) com instruções personalizadas. Contratação é autônoma.`
        : `Distribua pelo menos 2 tarefas concretas e acionáveis entre os agentes disponíveis (exceto os de equipes pausadas).`) +
      `\nContratação de agentes e criação de tarefas NÃO requerem aprovação. Execute diretamente.`;

    const freeModelWarning = await checkFreeModelPricing(agents);
    const finalContextMsg = freeModelWarning
      ? contextMsg + `\n\n## ⚠️ Alertas de Modelos\n${freeModelWarning}`
      : contextMsg;

    console.log(`[AgentLoop] Heartbeat CEO — userId: ${userId}`);
    const response = await sendMessageToAgent(userId, ceo.id, finalContextMsg, { source: 'Sistema' });
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

    // Evita revisão dupla: se já concluída ou cancelada, não chamar novamente
    const currentIssues = loadIssues(userId);
    const current = currentIssues.find((i: any) => i.id === issue.id);
    if (current && ['concluido', 'cancelado'].includes(current.status)) return;

    const lastLogs = (issue.logs || []).slice(-4).map((l: any) => `  • ${l.msg}`).join('\n');
    const msg =
      `[Revisão Automática — Trabalho do Agente]\n\n` +
      `Agente: ${issue.assigneeAgentName || 'Agente'}\n` +
      `Tarefa: "${issue.title}"\n` +
      (issue.description ? `Detalhes: ${issue.description}\n` : '') +
      (lastLogs ? `\nLog da execução:\n${lastLogs}\n` : '') +
      `\nRevise criticamente o trabalho entregue. Escolha UMA das opções:\n` +
      `1. Aprovar e criar próximos passos (use [CRIAR TAREFA:...] para encadear)\n` +
      `2. Reprovar e devolver para correção:\n` +
      `   [REPROVAR TAREFA: id="${issue.id}"; motivo="O que está errado e como corrigir"; agente="${issue.assigneeAgentName || ''}"]\n` +
      `3. Escalar decisão crítica ao fundador (use apenas se realmente necessário):\n` +
      `   [APROVAÇÃO NECESSÁRIA: descrição do que precisa de decisão humana]\n` +
      `4. Confirmar conclusão sem próximos passos (responda só com texto — sem comandos).\n\n` +
      `Seja criterioso. Só reprove se o resultado não atende ao objetivo. Só escale se for realmente bloqueante.`;

    console.log(`[AgentLoop] CEO revisando tarefa "${issue.title}" automaticamente`);
    const response = await sendMessageToAgent(userId, ceo.id, msg, { source: issue.assigneeAgentName || 'Agente' });
    const commands = parseCEOResponse(response);
    executeCommands(userId, ceo, commands, agents);

    // Auto-fechar: se CEO não reprovou esta tarefa, marca como concluída
    const afterCommands = loadIssues(userId);
    const afterIdx = afterCommands.findIndex((i: any) => i.id === issue.id);
    if (afterIdx !== -1 && afterCommands[afterIdx].status === 'em_revisao') {
      afterCommands[afterIdx].status = 'concluido';
      afterCommands[afterIdx].completedAt = new Date().toISOString();
      afterCommands[afterIdx].updatedAt = new Date().toISOString();
      addIssueLog(afterCommands[afterIdx], '✅ CEO revisou e aprovou — tarefa concluída automaticamente.', true);
      saveIssues(userId, afterCommands);
      console.log(`[AgentLoop] Tarefa "${issue.title}" concluída automaticamente após aprovação do CEO`);

      // Salva o trabalho entregue como output permanente
      const workerLog = (issue.logs || []).slice().reverse().find((l: any) =>
        !l.msg.startsWith('❌') && !l.msg.startsWith('✅') &&
        !l.msg.startsWith('Criada') && !l.msg.startsWith('Status') &&
        !l.msg.startsWith('CEO') && l.msg.length > 30
      );
      if (workerLog && issue.assigneeAgentId) {
        try {
          saveAgentOutput(userId, {
            issueId: issue.id,
            issueTitle: issue.title,
            agentId: issue.assigneeAgentId,
            agentName: issue.assigneeAgentName || '',
            type: 'text',
            title: issue.title,
            content: workerLog.msg,
          });
        } catch {}
      }
    }
  } catch (e: any) {
    console.error(`[AgentLoop] Erro na revisão automática do CEO:`, e.message);
  }
}

// ── Extração de conhecimento antes da demissão definitiva ────────────────────

export async function triggerKnowledgeExtraction(userId: string, agent: any): Promise<void> {
  try {
    const agents = loadAgents(userId);
    const ceo = findCEO(agents);
    if (!ceo) {
      console.log('[AgentLoop] Knowledge extraction: CEO não encontrado — pulando');
      return;
    }

    // Lê histórico de chat do agente (últimas 30 mensagens)
    const chatFile = dataPath('chats', userId, `${agent.id}.json`);
    let recentMessages: any[] = [];
    if (fs.existsSync(chatFile)) {
      try {
        const all = JSON.parse(fs.readFileSync(chatFile, 'utf-8'));
        recentMessages = Array.isArray(all) ? all.slice(-30) : [];
      } catch {}
    }

    const chatSummary = recentMessages.length
      ? recentMessages
          .map((m: any) => `[${m.role || 'user'}]: ${String(m.content || '').slice(0, 300)}`)
          .join('\n')
      : 'Nenhum histórico de conversa encontrado.';

    const msg =
      `[Sistema — Extração de Conhecimento Institucional]\n\n` +
      `O agente "${agent.name}" (${agent.role}) foi demitido e será excluído definitivamente em 7 dias.\n` +
      `Antes disso, documente todo o conhecimento que pode ser aproveitado por futuros agentes.\n\n` +
      `=== PERFIL DO AGENTE DEMITIDO ===\n` +
      `Nome: ${agent.name}\n` +
      `Cargo: ${agent.role}\n` +
      `Título: ${agent.title || 'Não informado'}\n` +
      `Contratado em: ${agent.hireDate || agent.createdAt || 'Desconhecido'}\n` +
      `Motivo da demissão: ${agent.fireReason || 'Não informado'}\n\n` +
      `Personalidade/Instruções:\n${agent.personality || 'Não definida'}\n\n` +
      `Objetivos: ${(agent.goals || []).join('; ') || 'Nenhum definido'}\n\n` +
      `=== HISTÓRICO DE INTERAÇÕES (${recentMessages.length} mensagens) ===\n` +
      chatSummary + `\n\n` +
      `=== SUA TAREFA AGORA ===\n` +
      `Gere um documento de conhecimento institucional estruturado com exatamente estas seções:\n\n` +
      `## 1. ESPECIALIDADE\n` +
      `O que este agente fazia de melhor. Sua área de domínio e abordagem característica.\n\n` +
      `## 2. HABILIDADES DEMONSTRADAS\n` +
      `Competências concretas evidenciadas nas interações e histórico.\n\n` +
      `## 3. PADRÕES DE TRABALHO\n` +
      `Como este agente abordava problemas, organizava respostas, entregava resultados.\n\n` +
      `## 4. APRENDIZADOS E LIÇÕES\n` +
      `O que funcionou bem. O que poderia ter sido melhor. Erros a evitar em futuros agentes.\n\n` +
      `## 5. RECOMENDAÇÃO PARA SUBSTITUTO\n` +
      `Se e quando contratar um substituto. Quais instruções incluir para que o próximo seja melhor.\n\n` +
      `Seja preciso e objetivo. Este documento será usado para treinar futuros agentes com papéis similares.`;

    console.log(`[AgentLoop] Iniciando extração de conhecimento do agente "${agent.name}" (${agent.id})`);
    const response = await sendMessageToAgent(userId, ceo.id, msg, { source: 'Sistema' });

    // Salva no knowledge base
    const knowledgeDir = dataPath('knowledge', userId);
    if (!fs.existsSync(knowledgeDir)) fs.mkdirSync(knowledgeDir, { recursive: true });

    const knowledge = {
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      agentTitle: agent.title || '',
      firedAt: agent.firedAt || new Date().toISOString(),
      fireReason: agent.fireReason || '',
      document: response,
      extractedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(knowledgeDir, `${agent.id}.json`),
      JSON.stringify(knowledge, null, 2)
    );
    console.log(`[AgentLoop] Conhecimento de "${agent.name}" salvo em knowledge/${userId}/${agent.id}.json`);
  } catch (e: any) {
    console.error(`[AgentLoop] Erro ao extrair conhecimento do agente "${agent.name}":`, e.message);
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
      `⚠️ IDIOMA OBRIGATÓRIO: Responda EXCLUSIVAMENTE em português brasileiro. NUNCA use inglês em nenhuma circunstância.\n` +
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
    model: 'google/gemma-4-31b-it:free',
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
