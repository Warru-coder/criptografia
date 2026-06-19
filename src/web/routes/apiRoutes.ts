import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { pipeline } from 'stream/promises';
import { encryptFile, EncryptProgress } from '../../crypto/fileCipher';
import { decryptFile, DecryptProgress } from '../../crypto/fileDecipher';
import { encryptDirectory, decryptDirectory, DirectoryProgress } from '../../filesystem/directoryProcessor';
import { env, ensureAppDataDirs } from '../../config';
import { usersExist } from '../../database/userRepository';
import { ForbiddenPathError } from '../../core/errorHandler';
import { requireSession } from '../middleware/requireSession';
import { sandboxPath } from '../middleware/pathSandbox';
import { logger } from '../../utils/logger';

const router = express.Router();

ensureAppDataDirs();

const upload = multer({
  dest: env.tmpDir,
  limits: { fileSize: env.uploadLimitBytes },
});

// MED-05 / ADR-0013: per-user SSE channel. The previous version maintained a
// single Set<Response> for all clients and broadcast everything to everyone,
// leaking filenames between users. Now keyed by userId.
const progressClientsByUser: Map<string, Set<express.Response>> = new Map();

export function broadcastProgress(userId: string, progress: Record<string, unknown>): void {
  const set = progressClientsByUser.get(userId);
  if (!set || set.size === 0) return;
  const data = `data: ${JSON.stringify(progress)}\n\n`;
  for (const res of set) {
    res.write(data);
  }
}

router.get('/progress', requireSession, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const uid = req.userId;
  let set = progressClientsByUser.get(uid);
  if (!set) {
    set = new Set();
    progressClientsByUser.set(uid, set);
  }
  set.add(res);

  req.on('close', () => {
    const s = progressClientsByUser.get(uid);
    if (s) {
      s.delete(res);
      if (s.size === 0) progressClientsByUser.delete(uid);
    }
  });
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
      broadcastProgress(req.userId, { type: 'encrypt', filename: req.file?.originalname, ...progress });
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
      broadcastProgress(req.userId, { type: 'decrypt', filename: req.file?.originalname, ...progress });
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
      broadcastProgress(req.userId, { type: 'encrypt-dir', ...progress });
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
      broadcastProgress(req.userId, { type: 'decrypt-dir', ...progress });
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
    hasUsers: usersExist(),
    registrationEnabled: env.enableRegistration,
    webauthnEnabled: env.enableWebAuthn,
    aiEnabled: env.enableAi,
    uptime: process.uptime(),
  });
});

// ALTA-09 / ADR-0013: /verify requires session and reads only the header
// (148 bytes) from disk instead of the whole upload — closes both the
// "anonymous DoS via 10 GB upload" hole and the "load whole file" memory waste.
//
// We use a verify-specific multer with a 1 MiB limit (more than the 148 bytes
// we need, but enough margin to still accept the upload framing).
const verifyUpload = multer({ dest: env.tmpDir, limits: { fileSize: 1 * 1024 * 1024 } });

router.post('/verify', requireSession, verifyUpload.single('file'), async (req, res) => {
  const tmpPath = req.file?.path;
  try {
    if (!req.file || !tmpPath) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileSize = req.file.size;
    if (fileSize < 148) {
      res.status(400).json({ error: 'File too small to be a valid encrypted file' });
      return;
    }

    // Read only the header bytes (no full-file load into memory).
    const fd = await fs.promises.open(tmpPath, 'r');
    const headerBuf = Buffer.alloc(148);
    try {
      await fd.read(headerBuf, 0, 148, 0);
    } finally {
      await fd.close();
    }

    const magic = headerBuf.subarray(0, 6).toString();
    const isValidMagic = magic === 'SCRYPT';
    const version = isValidMagic ? headerBuf.readUInt8(6) : null;
    const hasAuthTag = fileSize > 128 + 16;

    res.json({
      valid: isValidMagic,
      isEncryptedFile: isValidMagic,
      version,
      hasAuthTag,
      fileSize,
      message: isValidMagic
        ? `File appears to be a valid SecureCrypt v${version} encrypted file`
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
