import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { DATA_DIR, dataDir, dataPath } from '../lib/data-dir.js';

const USERS_FILE = dataPath('users.json');

interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

function getUsers(): User[] {
  if (!fs.existsSync(USERS_FILE)) return [];
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
}

function saveUsers(users: User[]) {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'mwcode-secret-key-change-in-production';

// POST /auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }

    const users = getUsers();
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ error: 'Email já cadastrado' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user: User = {
      id: crypto.randomUUID(),
      email,
      password: hashedPassword,
      name,
      createdAt: new Date().toISOString()
    };

    users.push(user);
    saveUsers(users);

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar' });
  }
});

// POST /auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const users = getUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const valid = await bcrypt.compare(password, user.password);
    
    if (!valid) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

// PUT /auth/profile — atualiza nome, email e/ou senha
authRouter.put('/profile', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Não autorizado' });
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    const users = getUsers();
    const idx = users.findIndex(u => u.id === decoded.userId);
    if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { name, email, password, currentPassword } = req.body;

    // Verificar senha atual se estiver mudando senha ou email
    if (password || email) {
      if (!currentPassword) return res.status(400).json({ error: 'Informe sua senha atual para alterar email ou senha.' });
      const valid = await bcrypt.compare(currentPassword, users[idx].password);
      if (!valid) return res.status(400).json({ error: 'Senha atual incorreta.' });
    }

    if (name) users[idx].name = name;
    if (email) {
      const emailTaken = users.some((u, i) => u.email === email && i !== idx);
      if (emailTaken) return res.status(400).json({ error: 'E-mail já está em uso por outra conta.' });
      users[idx].email = email;
    }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Senha deve ter pelo menos 6 caracteres.' });
      users[idx].password = await bcrypt.hash(password, 10);
    }

    saveUsers(users);
    const u = users[idx];
    const newToken = jwt.sign({ userId: u.id, email: u.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, token: newToken, user: { id: u.id, email: u.email, name: u.name } });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// DELETE /auth/account — apaga conta completa: usuário + workspace + chaves
authRouter.delete('/account', (req: any, res: any) => {
  // Aceita tanto req.userId (injetado por authMiddleware quando montado com ele)
  // quanto verificação manual do token (igual ao PUT /profile)
  let userId: string | null = req.userId || null;

  if (!userId) {
    const auth = req.headers.authorization as string | undefined;
    if (!auth) return res.status(401).json({ error: 'Não autorizado' });
    try {
      const decoded = jwt.verify(
        auth.replace('Bearer ', ''),
        process.env.JWT_SECRET || 'mwcode-secret-key-change-in-production'
      ) as { userId: string };
      userId = decoded.userId;
    } catch {
      return res.status(401).json({ error: 'Token inválido' });
    }
  }

  // Remove do users.json
  const users = getUsers();
  const idx = users.findIndex((u: User) => u.id === userId);
  if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });
  users.splice(idx, 1);
  saveUsers(users);

  // Remove todos os dados do workspace
  const rmFile = (p: string) => { if (fs.existsSync(p)) fs.unlinkSync(p); };
  const rmDirR = (p: string) => { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }); };

  rmFile(path.join(DATA_DIR, `${userId}.json`));          // empresa
  rmDirR(dataDir('agents', userId));                      // agentes
  rmDirR(dataDir('chats', userId));                       // chats
  rmFile(dataPath('memories', `${userId}.json`));         // memórias
  rmDirR(path.join(DATA_DIR, 'skills', userId));          // skills
  rmFile(dataPath('workflows', `${userId}.json`));        // workflows
  rmFile(dataPath('tasks', `${userId}.json`));            // tarefas
  rmFile(dataPath('keys', `${userId}.json`));             // chaves de API

  res.json({ ok: true });
});

// GET /auth/me
authRouter.get('/me', (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Não autorizado' });
  
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    
    const users = getUsers();
    const user = users.find(u => u.id === decoded.userId);
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }
    
    res.json({ id: user.id, email: user.email, name: user.name });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});