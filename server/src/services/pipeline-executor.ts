import { loadRun, saveRun, type Run, type StepResult } from '../routes/runs.js';
import { sendMessageToAgent } from '../lib/agent-chat.js';
import { fetchGitHubFile } from '../lib/github-fetcher.js';
import { parseFrontmatter, parsePipelineYaml } from '../lib/yaml-parser.js';
import { saveAgentOutput } from '../routes/outputs.js';

interface PipelineStepDef {
  id: number;
  name: string;
  file?: string;
  type?: string; // "checkpoint"
}

function agentIdForStep(
  stepDef: PipelineStepDef,
  stepMeta: Record<string, any>,
  agentIdMap: Record<string, string>
): string | null {
  const mwcId = stepMeta.agent as string | undefined;
  if (mwcId && agentIdMap[mwcId]) return agentIdMap[mwcId];
  return null;
}

function buildStepPrompt(
  stepBody: string,
  run: Run,
  stepDef: PipelineStepDef,
  stepMeta: Record<string, any>
): string {
  const parts: string[] = [];

  if (run.userRequest) {
    parts.push(`## Solicitação do usuário\n${run.userRequest}\n`);
  }

  // Contexto de inputs anteriores (decisões de checkpoint)
  const relevantInputs = Object.entries(run.userInputs);
  if (relevantInputs.length > 0) {
    parts.push(`## Decisões do usuário (checkpoints anteriores)`);
    relevantInputs.forEach(([stepId, decision]) => {
      parts.push(`Checkpoint ${stepId}: ${decision}`);
    });
    parts.push('');
  }

  // Outputs de steps anteriores que este step precisa como input
  if (run.steps.length > 0) {
    parts.push(`## Outputs produzidos pelos steps anteriores`);
    run.steps.forEach(s => {
      if (s.output) {
        parts.push(`### ${s.stepName}\n${s.output.slice(0, 3000)}${s.output.length > 3000 ? '\n...(truncado)' : ''}`);
      }
    });
    parts.push('');
  }

  // Instrução do step
  parts.push(`## Sua tarefa: ${stepDef.name}\n${stepBody}`);

  return parts.join('\n');
}

async function executeStep(
  userId: string,
  run: Run,
  stepDef: PipelineStepDef,
  squad: any
): Promise<StepResult> {
  const agentIdMap: Record<string, string> = squad.agentIdMap || {};

  // Carregar e parsear o arquivo do step do GitHub
  const stepFilePath = `squads/${squad.pipelineCode}/pipeline/${stepDef.file}`;
  const stepRaw = await fetchGitHubFile(stepFilePath);
  const { meta: stepMeta, body: stepBody } = parseFrontmatter(stepRaw);

  // Descobrir qual agente executa este step
  const agentId = agentIdForStep(stepDef, stepMeta, agentIdMap);
  if (!agentId) throw new Error(`Agente não encontrado para step ${stepDef.id} (${stepMeta.agent})`);

  // Montar prompt completo
  const prompt = buildStepPrompt(stepBody, run, stepDef, stepMeta);

  const startedAt = new Date().toISOString();
  const output = await sendMessageToAgent(userId, agentId, prompt, {
    source: `Pipeline/${run.pipelineCode}/Step${stepDef.id}`,
  });

  const result: StepResult = {
    stepId: stepDef.id,
    stepName: stepDef.name,
    agentId,
    agentName: stepMeta.agent || agentId,
    output,
    outputFile: stepMeta.outputFile as string | undefined,
    startedAt,
    completedAt: new Date().toISOString(),
  };

  // Salvar output na aba de entregas automaticamente, nomeado com o tema
  try {
    const freshRun = loadRun(userId, run.id) || run;
    const theme = freshRun.theme || freshRun.userRequest || run.squadName;
    saveAgentOutput(userId, {
      agentId,
      agentName: stepMeta.agent || agentId,
      squadId: run.squadId,
      issueId: run.id,
      issueTitle: `[${run.id.slice(0, 8)}] ${theme}`,
      type: 'markdown',
      title: `[${run.id.slice(0, 8)}] Step ${stepDef.id} — ${stepDef.name}`,
      content: output,
    });
  } catch {}

  return result;
}

export async function startPipelineRun(
  userId: string,
  runId: string,
  squad: any
): Promise<void> {
  const run = loadRun(userId, runId);
  if (!run) throw new Error('Run não encontrada');

  const { steps, checkpoints } = parsePipelineYaml(squad.pipelineYaml);
  const checkpointIds = new Set(checkpoints.map(c => c.id));

  run.status = 'running';
  saveRun(userId, run);

  await executePipelineFrom(userId, run, steps, checkpoints, checkpointIds, squad, 0);
}

export async function resumeAfterCheckpoint(
  userId: string,
  runId: string,
  squad: any
): Promise<void> {
  const run = loadRun(userId, runId);
  if (!run) throw new Error('Run não encontrada');

  const { steps, checkpoints } = parsePipelineYaml(squad.pipelineYaml);
  const checkpointIds = new Set(checkpoints.map(c => c.id));

  // Encontrar o índice a partir do qual retomar
  const completedStepIds = new Set(run.steps.map(s => s.stepId));
  const handledCheckpoints = new Set(Object.keys(run.userInputs).map(Number));

  // Próximo step = primeiro que não foi completado nem é um checkpoint já tratado
  const resumeFrom = steps.findIndex(s =>
    !completedStepIds.has(s.id) && !handledCheckpoints.has(s.id)
  );

  if (resumeFrom === -1) {
    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    saveRun(userId, run);
    return;
  }

  await executePipelineFrom(userId, run, steps, checkpoints, checkpointIds, squad, resumeFrom);
}

async function executePipelineFrom(
  userId: string,
  run: Run,
  steps: PipelineStepDef[],
  checkpoints: Array<{ id: number; description: string }>,
  checkpointIds: Set<number>,
  squad: any,
  startIndex: number
): Promise<void> {
  for (let i = startIndex; i < steps.length; i++) {
    const stepDef = steps[i];

    // Recarregar run do disco a cada iteração (para ter estado atualizado)
    const fresh = loadRun(userId, run.id)!;

    // Checkpoint — pausar e aguardar decisão do usuário
    if (stepDef.type === 'checkpoint' || checkpointIds.has(stepDef.id)) {
      const cp = checkpoints.find(c => c.id === stepDef.id);
      const prevStep = fresh.steps[fresh.steps.length - 1];
      fresh.status = 'checkpoint';
      fresh.currentStepId = stepDef.id;
      fresh.checkpoint = {
        stepId: stepDef.id,
        description: cp?.description || stepDef.name,
        previousStepId: prevStep?.stepId,
      };
      saveRun(userId, fresh);
      return; // Para aqui — retomado via POST /checkpoint
    }

    // Step de execução
    fresh.status = 'running';
    fresh.currentStepId = stepDef.id;
    saveRun(userId, fresh);

    try {
      const result = await executeStep(userId, fresh, stepDef, squad);
      const updated = loadRun(userId, run.id)!;
      updated.steps.push(result);
      saveRun(userId, updated);
    } catch (e: any) {
      const updated = loadRun(userId, run.id)!;
      updated.status = 'failed';
      updated.error = `Step ${stepDef.id} (${stepDef.name}): ${e.message}`;
      saveRun(userId, updated);
      throw e;
    }
  }

  // Todos os steps concluídos
  const final = loadRun(userId, run.id)!;
  final.status = 'completed';
  final.completedAt = new Date().toISOString();
  saveRun(userId, final);
}
