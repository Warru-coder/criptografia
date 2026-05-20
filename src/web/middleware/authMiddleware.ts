import { Request, Response, NextFunction } from 'express';
import { isVaultInitialized } from '../../passwordManager/secureStorage';

export function requireVault(req: Request, res: Response, next: NextFunction): void {
  if (!isVaultInitialized()) {
    res.status(403).json({
      error: 'Vault not initialized. Please initialize first.',
    });
    return;
  }
  next();
}
