import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { pipeline } from 'stream/promises';
import { encryptFile, EncryptProgress } from '../../crypto/fileCipher';
import { decryptFile, DecryptProgress } from '../../crypto/fileDecipher';
import { encryptDirectory, decryptDirectory, DirectoryProgress } from '../../filesystem/directoryProcessor';
import { verifyMasterPassword, isVaultInitialized, setupMasterPassword } from '../../passwordManager/secureStorage';
import { validatePassword } from '../../passwordManager/passwordValidator';
import { ensureAppDataDirs } from '../../core/appConfig';
import { ForbiddenPathError } from '../../core/errorHandler';
import { requireSession } from '../middleware/requireSession';
import { sandboxPath } from '../middleware/pathSandbox';
import { logger } from '../../utils/logger';

const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '..', '..', '..', 'tmp'),
  limits: { fileSize: 10 * 1024 * 1024 * 1024 },
});

const progressClients: Set<express.Response> = new Set();

export function broadcastProgress(progress: Record<string, unknown>): void {
  const data = `data: ${JSON.stringify(progress)}\n\n`;
  for (const res of progressClients) {
    res.write(data);
  }
}

router.get('/progress', (_req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  progressClients.add(res);
  _req.on('close', () => progressClients.delete(res));
});

router.post('/init', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    if (isVaultInitialized()) {
      res.status(400).json({ error: 'Vault already initialized' });
      return;
    }

    const validation = validatePassword(password);
    if (!validation.isValid) {
      res.status(400).json({ errors: validation.errors });
      return;
    }

    ensureAppDataDirs();
    await setupMasterPassword(password);

    logger.info('Vault initialized via web UI');
    res.json({ success: true, message: 'Vault created successfully' });
  } catch (error) {
    logger.error(`Init failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Kept for backwards compatibility — clients can verify without creating a session
router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }
    const isValid = await verifyMasterPassword(password);
    res.status(isValid ? 200 : 401).json({ valid: isValid });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

// SEC-004: file encryption/decryption uses session auth — password never leaves login endpoint
router.post('/encrypt', requireSession, upload.single('file'), async (req, res) => {
  const tmpInput = req.file?.path;
  const tmpOutput = tmpInput ? tmpInput + '.scrypt' : undefined;

  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const masterKey = req.masterKey;
    await encryptFile(tmpInput!, tmpOutput!, masterKey, (progress: EncryptProgress) => {
      broadcastProgress({ type: 'encrypt', filename: req.file?.originalname, ...progress });
    });

    const fileStat = fs.statSync(tmpOutput!);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(tmpOutput!)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileStat.size.toString());

    await pipeline(fs.createReadStream(tmpOutput!), res);
    logger.info(`File encrypted via web UI: ${req.file.originalname}`);
  } catch (error) {
    logger.error(`Encrypt failed: ${(error as Error).message}`);
    if (!res.headersSent) res.status(500).json({ error: (error as Error).message });
  } finally {
    // SEC-010: always clean up temp files, even on error
    if (tmpInput) await fs.promises.unlink(tmpInput).catch(() => {});
    if (tmpOutput) await fs.promises.unlink(tmpOutput).catch(() => {});
  }
});

router.post('/decrypt', requireSession, upload.single('file'), async (req, res) => {
  const tmpInput = req.file?.path;
  const tmpOutput = tmpInput ? tmpInput + '.decrypted' : undefined;

  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const masterKey = req.masterKey;
    await decryptFile(tmpInput!, tmpOutput!, masterKey, (progress: DecryptProgress) => {
      broadcastProgress({ type: 'decrypt', filename: req.file?.originalname, ...progress });
    });

    const fileStat = fs.statSync(tmpOutput!);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(tmpOutput!)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileStat.size.toString());

    await pipeline(fs.createReadStream(tmpOutput!), res);
    logger.info(`File decrypted via web UI: ${req.file.originalname}`);
  } catch (error) {
    logger.error(`Decrypt failed: ${(error as Error).message}`);
    if (!res.headersSent) res.status(500).json({ error: (error as Error).message });
  } finally {
    if (tmpInput) await fs.promises.unlink(tmpInput).catch(() => {});
    if (tmpOutput) await fs.promises.unlink(tmpOutput).catch(() => {});
  }
});

router.post('/encrypt-dir', requireSession, async (req, res) => {
  try {
    const { inputPath, outputPath } = req.body;

    if (!inputPath) {
      res.status(400).json({ error: 'inputPath is required' });
      return;
    }

    // SEC-001: validate paths are within the allowed sandbox
    let safeInput: string;
    let safeOutput: string;
    try {
      safeInput = sandboxPath(inputPath);
      safeOutput = sandboxPath(outputPath || inputPath + '.encrypted');
    } catch (err) {
      if (err instanceof ForbiddenPathError) {
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (!fs.existsSync(safeInput)) {
      res.status(400).json({ error: 'Input directory not found' });
      return;
    }
    if (!fs.statSync(safeInput).isDirectory()) {
      res.status(400).json({ error: 'Input path is not a directory' });
      return;
    }

    const masterKey = req.masterKey;
    const result = await encryptDirectory(safeInput, safeOutput, masterKey, (progress: DirectoryProgress) => {
      broadcastProgress({ type: 'encrypt-dir', ...progress });
    });

    logger.info(`Directory encrypted via web UI: ${safeInput}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error(`Directory encrypt failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/decrypt-dir', requireSession, async (req, res) => {
  try {
    const { inputPath, outputPath } = req.body;

    if (!inputPath) {
      res.status(400).json({ error: 'inputPath is required' });
      return;
    }

    // SEC-001: validate paths are within the allowed sandbox
    let safeInput: string;
    let safeOutput: string;
    try {
      safeInput = sandboxPath(inputPath);
      safeOutput = sandboxPath(outputPath || inputPath + '.decrypted');
    } catch (err) {
      if (err instanceof ForbiddenPathError) {
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (!fs.existsSync(safeInput)) {
      res.status(400).json({ error: 'Input directory not found' });
      return;
    }
    if (!fs.statSync(safeInput).isDirectory()) {
      res.status(400).json({ error: 'Input path is not a directory' });
      return;
    }

    const masterKey = req.masterKey;
    const result = await decryptDirectory(safeInput, safeOutput, masterKey, (progress: DirectoryProgress) => {
      broadcastProgress({ type: 'decrypt-dir', ...progress });
    });

    logger.info(`Directory decrypted via web UI: ${safeInput}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error(`Directory decrypt failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/status', (_req, res) => {
  res.json({
    vaultInitialized: isVaultInitialized(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

router.post('/verify', upload.single('file'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file || !tmpPath) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileBuffer = fs.readFileSync(tmpPath);

    if (fileBuffer.length < 148) {
      res.status(400).json({ error: 'File too small to be a valid encrypted file' });
      return;
    }

    const magic = fileBuffer.subarray(0, 6).toString();
    const isValidMagic = magic === 'SCRYPT';
    const hasAuthTag = fileBuffer.length > 128 + 16;

    res.json({
      valid: isValidMagic,
      isEncryptedFile: isValidMagic,
      hasAuthTag,
      fileSize: fileBuffer.length,
      message: isValidMagic
        ? 'File appears to be a valid SecureCrypt encrypted file'
        : 'File is not a SecureCrypt encrypted file',
    });
  } catch (error) {
    logger.error(`Verify failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    if (tmpPath) await fs.promises.unlink(tmpPath).catch(() => {});
  }
});

export { router as apiRoutes };
