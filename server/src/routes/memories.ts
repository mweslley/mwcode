import { Router } from 'express';
import fs from 'fs';
import path from 'path';

const MEMORY_DIR = path.resolve(__dirname, '../../../data/memories');

interface Memory {
  id: string;
  userId: string;
  type: 'conversation' | 'context' | 'preference' | 'feedback';
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

function getMemoryDir(userId: string): string {
  const dir = path.join(MEMORY_DIR, userId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getMemories(userId: string, type?: string): Memory[] {
  const dir = getMemoryDir(userId);
  if (!fs.existsSync(dir)) return [];
  
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  const memories: Memory[] = [];
  
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
    if (!type || data.type === type) {
      memories.push(data);
    }
  }
  
  return memories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export const memoriesRouter = Router();

// Get all memories for user
memoriesRouter.get('/', (req, res) => {
  const userId = (req as any).userId;
  const type = req.query.type as string;
  res.json(getMemories(userId, type));
});

// Save a new memory
memoriesRouter.post('/', (req, res) => {
  const userId = (req as any).userId;
  const { type, title, content } = req.body;
  
  if (!type || !title || !content) {
    return res.status(400).json({ error: 'type, title e content são obrigatórios' });
  }
  
  const memory: Memory = {
    id: crypto.randomUUID(),
    userId,
    type,
    title,
    content,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const dir = getMemoryDir(userId);
  fs.writeFileSync(path.join(dir, `${memory.id}.json`), JSON.stringify(memory, null, 2));
  
  res.json(memory);
});

// Update memory
memoriesRouter.put('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  const { title, content } = req.body;
  
  const dir = getMemoryDir(userId);
  const file = path.join(dir, `${id}.json`);
  
  if (!fs.existsSync(file)) {
    return res.status(404).json({ error: 'Memória não encontrada' });
  }
  
  const memory: Memory = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (title) memory.title = title;
  if (content) memory.content = content;
  memory.updatedAt = new Date().toISOString();
  
  fs.writeFileSync(file, JSON.stringify(memory, null, 2));
  res.json(memory);
});

// Delete memory
memoriesRouter.delete('/:id', (req, res) => {
  const userId = (req as any).userId;
  const { id } = req.params;
  
  const dir = getMemoryDir(userId);
  const file = path.join(dir, `${id}.json`);
  
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
  }
  
  res.json({ success: true });
});

// Save conversation automatically
memoriesRouter.post('/auto', (req, res) => {
  const userId = (req as any).userId;
  const { title, messages } = req.body;
  
  const memory: Memory = {
    id: crypto.randomUUID(),
    userId,
    type: 'conversation',
    title: title || 'Conversa ' + new Date().toLocaleDateString('pt-BR'),
    content: JSON.stringify(messages, null, 2),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const dir = getMemoryDir(userId);
  fs.writeFileSync(path.join(dir, `${memory.id}.json`), JSON.stringify(memory, null, 2));
  
  res.json(memory);
});