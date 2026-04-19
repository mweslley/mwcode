import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      companyId?: string;
    }
  }
}

export function companyMiddleware(req: Request, _res: Response, next: NextFunction) {
  req.companyId = (req.header('x-company-id') as string) || 'default';
  next();
}
