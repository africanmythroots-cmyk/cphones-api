import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';

export function adminMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized: Authentication required' });
  }

  // Support both lowercase and uppercase variations for flexibility
  const role = req.user.role.toUpperCase();

  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
}
