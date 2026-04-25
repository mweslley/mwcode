import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mwcode-secret-key-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  
  if (!auth) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const token = auth.replace('Bearer ', '');
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}