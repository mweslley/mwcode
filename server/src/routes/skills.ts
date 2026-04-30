import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { dataDir } from '../lib/data-dir.js';

interface Skill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  tools?: string[];
  model?: string;
  userId: string;
  createdAt: string;
}

function getSkillsDir(userId: string): string {
  return dataDir('skills', userId); // ~/.mwcode/data/skills/{userId}/
}

function getSkills(userId: string): Skill[] {
  const dir = getSkillsDir(userId);
  if (!fs.existsSync(dir)) return [];
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const skills: Skill[] = [];
  
  for (const file of files) {
    skills.push(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8')));
  }
  
  return skills;
}

export const skillsRouter = Router();

// Get all skills
skillsRouter.get('/', (req, res) => {
  const userId = (req as any).userId;
  res.json(getSkills(userId));
});

// Create skill
skillsRouter.post('/', (req, res) => {
  const userId = (req as any).userId;
  const { name, description, prompt, tools, model } = req.body;
  
  if (!name || !prompt) {
    return res.status(400).json({ error: 'name e prompt são obrigatórios' });
  }
  
  const skill: Skill = {
    id: crypto.randomUUID(),
    name,
    description: description || '',
    prompt,
    tools,
    model,
    userId,
    createdAt: new Date().toISOString()
  };
  
  const dir = getSkillsDir(userId);
  fs.writeFileSync(path.join(dir, `${skill.id}.json`), JSON.stringify(skill, null, 2));
  
  res.json(skill);
});

// Update skill
skillsRouter.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { name, description, prompt, tools, model } = req.body;
  
  const dir = getSkillsDir(userId);
  const file = path.join(dir, `${id}.json`);
  
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Skill não encontrada' });
  }
  
  const skill: Skill = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (name) skill.name = name;
  if (description) skill.description = description;
  if (prompt) skill.prompt = prompt;
  if (tools) skill.tools = tools;
  if (model) skill.model = model;
  
  fs.writeFileSync(file, JSON.stringify(skill, null, 2));
  res.json(skill);
});

// Delete skill
skillsRouter.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  
  const dir = getSkillsDir(userId);
  const file = path.join(dir, `${id}.json`);
  
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
  
  res.json({ success: true });
});

// POST /api/skills/import-url — busca conteúdo de uma URL para preview antes de salvar
skillsRouter.post('/import-url', async (req: any, res: any) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'URL obrigatória' });

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'MWCode-SkillsImport/1.0', Accept: 'text/plain, text/html, */*' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return res.status(502).json({ error: `O site retornou erro ${r.status}` });

    const raw = await r.text();
    // Extrai só texto legível (remove HTML tags se for HTML)
    const isHtml = (r.headers.get('content-type') || '').includes('html');
    const content = isHtml
      ? raw.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
             .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/\s{2,}/g, '\n')
             .trim()
      : raw;

    return res.json({ content: content.slice(0, 12_000), url });
  } catch (e: any) {
    return res.status(502).json({ error: 'Não foi possível acessar a URL: ' + e.message });
  }
});

// Use skill in chat
skillsRouter.post('/:id/use', async (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { message } = req.body;
  
  const dir = getSkillsDir(userId);
  const file = path.join(dir, `${id}.json`);
  
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Skill não encontrada' });
  }
  
  const skill: Skill = JSON.parse(fs.readFileSync(file, 'utf-8'));
  
  // Aqui chamaria a IA com o prompt do skill
  // Por agora retorna o prompt para uso
  res.json({
    skill,
    enhancedPrompt: `${skill.prompt}\n\nUsuário: ${message}`
  });
});