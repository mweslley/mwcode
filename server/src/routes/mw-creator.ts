import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { dataDir } from '../lib/data-dir.js';
import { fetchGitHubFile, fetchGitHubDir } from '../lib/github-fetcher.js';
import { parseFrontmatter, parseCsv, parsePipelineYaml } from '../lib/yaml-parser.js';

export const mwCreatorRouter = Router();

const MW_REPO = 'mweslley/mw-creator';
const SQUADS_DIR = 'squads';

// ── GET /api/mw-creator/squads — lista squads disponíveis ────────────────────

mwCreatorRouter.get('/squads', async (req: any, res: any) => {
  try {
    const entries = await fetchGitHubDir(SQUADS_DIR);
    const squads = await Promise.all(
      entries
        .filter(e => e.type === 'dir' && !e.name.startsWith('.'))
        .map(async e => {
          try {
            const yaml = await fetchGitHubFile(`${SQUADS_DIR}/${e.name}/squad.yaml`);
            const meta = parseSimpleSquadYaml(yaml);
            return { code: e.name, name: meta.name || e.name, description: meta.description || '' };
          } catch {
            return { code: e.name, name: e.name, description: '' };
          }
        })
    );
    res.json(squads.filter(s => s.code !== '.gitkeep'));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/mw-creator/squads/:code — preview do squad ─────────────────────

mwCreatorRouter.get('/squads/:code', async (req: any, res: any) => {
  const { code } = req.params;
  try {
    const [squadYamlRaw, csvRaw, pipelineRaw] = await Promise.all([
      fetchGitHubFile(`${SQUADS_DIR}/${code}/squad.yaml`),
      fetchGitHubFile(`${SQUADS_DIR}/${code}/squad-party.csv`),
      fetchGitHubFile(`${SQUADS_DIR}/${code}/pipeline/pipeline.yaml`),
    ]);

    const meta = parseSimpleSquadYaml(squadYamlRaw);
    const agents = parseCsv(csvRaw);
    const { name: pipelineName, steps, checkpoints } = parsePipelineYaml(pipelineRaw);

    res.json({
      code,
      name: meta.name,
      description: meta.description,
      skills: meta.skills || [],
      agents: agents.map(a => ({ id: a.id, name: a.name, title: a.title })),
      pipeline: { name: pipelineName, steps, checkpoints },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/mw-creator/import/:code — importa squad completo ───────────────

mwCreatorRouter.post('/import/:code', async (req: any, res: any) => {
  const { code } = req.params;
  const userId = req.userId;
  const companyId = req.companyId || 'default';

  try {
    // 1. Carregar todos os arquivos do GitHub
    const [squadYamlRaw, csvRaw, pipelineRaw] = await Promise.all([
      fetchGitHubFile(`${SQUADS_DIR}/${code}/squad.yaml`),
      fetchGitHubFile(`${SQUADS_DIR}/${code}/squad-party.csv`),
      fetchGitHubFile(`${SQUADS_DIR}/${code}/pipeline/pipeline.yaml`),
    ]);

    const meta = parseSimpleSquadYaml(squadYamlRaw);
    const agentRows = parseCsv(csvRaw);
    const { steps, checkpoints } = parsePipelineYaml(pipelineRaw);

    // 2. Carregar e criar cada agente
    const agentIdMap: Record<string, string> = {};
    const agentsDir = dataDir('agents', userId);
    const createdAgents: any[] = [];

    for (const row of agentRows) {
      if (!row.id || !row.path) continue;
      let personality = '';
      let agentMeta: Record<string, any> = {};
      try {
        const agentMdPath = row.path.replace('./', `${SQUADS_DIR}/${code}/`);
        const agentRaw = await fetchGitHubFile(agentMdPath);
        const { meta: fm, body } = parseFrontmatter(agentRaw);
        agentMeta = fm;
        personality = agentRaw; // full .agent.md as personality
      } catch { personality = `${row.name} — ${row.title}`; }

      // Verificar se já existe agente com mesmo nome (evitar duplicata)
      const existing = fs.existsSync(agentsDir)
        ? fs.readdirSync(agentsDir)
            .filter(f => f.endsWith('.json'))
            .map(f => JSON.parse(fs.readFileSync(path.join(agentsDir, f), 'utf-8')))
            .find((a: any) => a.name === (agentMeta.name || row.name))
        : null;

      if (existing) {
        agentIdMap[row.id] = existing.id;
        createdAgents.push(existing);
        continue;
      }

      const agentId = crypto.randomUUID();
      const agent = {
        id: agentId,
        userId,
        name: agentMeta.name || row.name,
        role: agentMeta.title || row.title,
        personality,
        goals: [],
        skills: agentMeta.skills || [],
        model: 'google/gemini-flash-1.5:free',
        provider: 'openrouter',
        status: 'active',
        hireDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        mwCreatorId: row.id,
        squadCode: code,
      };

      if (!fs.existsSync(agentsDir)) fs.mkdirSync(agentsDir, { recursive: true });
      fs.writeFileSync(path.join(agentsDir, `${agentId}.json`), JSON.stringify(agent, null, 2));
      agentIdMap[row.id] = agentId;
      createdAgents.push(agent);
    }

    // 3. Identificar líder (primeiro agente da lista ou com role "roteiro"?)
    // Usar o primeiro da lista que não seja QC/Veredito como líder
    const leaderRow = agentRows[0];
    const leaderId = leaderRow ? agentIdMap[leaderRow.id] : undefined;

    // 4. Criar o squad
    const { name: pipelineName } = parsePipelineYaml(pipelineRaw);
    const squadId = crypto.randomUUID();
    const squad = {
      id: squadId,
      name: meta.name || code,
      description: meta.description || '',
      mission: meta.description || '',
      agentIds: agentRows.map(r => agentIdMap[r.id]).filter(Boolean),
      leaderId,
      status: 'active',
      companyId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // mw-creator fields
      pipelineCode: code,
      pipelineYaml: pipelineRaw,
      pipelineName,
      agentIdMap,
      importedFrom: 'mw-creator',
    };

    const squadsDir = dataDir('squads', companyId);
    fs.writeFileSync(path.join(squadsDir, `${squadId}.json`), JSON.stringify(squad, null, 2));

    res.json({
      squad,
      agentsCreated: createdAgents.length,
      pipeline: { steps, checkpoints },
    });
  } catch (e: any) {
    console.error('[mw-creator import]', e);
    res.status(500).json({ error: e.message });
  }
});

// ── Helper: parseia squad.yaml (formato simples) ─────────────────────────────

function parseSimpleSquadYaml(raw: string): Record<string, any> {
  const result: Record<string, any> = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^(\w[\w-]*):\s*(.*)/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val.startsWith('[')) {
      const inner = val.slice(1, val.lastIndexOf(']'));
      result[m[1]] = inner ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
    } else {
      result[m[1]] = val;
    }
  }
  return result;
}
