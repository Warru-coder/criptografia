import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { pipeline } from 'stream/promises';
import { encryptFile, EncryptProgress } from '../../crypto/fileCipher';
import { decryptFile, DecryptProgress } from '../../crypto/fileDecipher';
import { encryptDirectory, decryptDirectory, DirectoryProgress } from '../../filesystem/directoryProcessor';
import { verifyMasterPassword, getMasterKey, isVaultInitialized, setupMasterPassword } from '../../passwordManager/secureStorage';
import { validatePassword } from '../../passwordManager/passwordValidator';
import { ensureAppDataDirs } from '../../core/appConfig';
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

router.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  progressClients.add(res);

  req.on('close', () => {
    progressClients.delete(res);
  });
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

router.post('/verify-password', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const isValid = await verifyMasterPassword(password);

    if (isValid) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false, error: 'Invalid password' });
    }
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/encrypt', upload.single('file'), async (req, res) => {
  try {
    const { password } = req.body;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const isValid = await verifyMasterPassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const masterKey = await getMasterKey(password);
    const inputPath = req.file.path;
    const outputPath = inputPath + '.scrypt';

    await encryptFile(inputPath, outputPath, masterKey, (progress: EncryptProgress) => {
      broadcastProgress({
        type: 'encrypt',
        filename: req.file?.originalname,
        ...progress,
      });
    });

    const fileStat = fs.statSync(outputPath);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileStat.size.toString());

    const fileStream = fs.createReadStream(outputPath);
    await pipeline(fileStream, res);

    fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    logger.info(`File encrypted via web UI: ${req.file.originalname}`);
  } catch (error) {
    logger.error(`Encrypt failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/decrypt', upload.single('file'), async (req, res) => {
  try {
    const { password } = req.body;

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    if (!password) {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

    const isValid = await verifyMasterPassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const masterKey = await getMasterKey(password);
    const inputPath = req.file.path;
    const outputPath = inputPath + '.decrypted';

    await decryptFile(inputPath, outputPath, masterKey, (progress: DecryptProgress) => {
      broadcastProgress({
        type: 'decrypt',
        filename: req.file?.originalname,
        ...progress,
      });
    });

    const fileStat = fs.statSync(outputPath);
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(outputPath)}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', fileStat.size.toString());

    const fileStream = fs.createReadStream(outputPath);
    await pipeline(fileStream, res);

    fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }

    logger.info(`File decrypted via web UI: ${req.file.originalname}`);
  } catch (error) {
    logger.error(`Decrypt failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/encrypt-dir', async (req, res) => {
  try {
    const { password, inputPath, outputPath } = req.body;

    if (!password || !inputPath) {
      res.status(400).json({ error: 'Password and inputPath are required' });
      return;
    }

    if (!fs.existsSync(inputPath)) {
      res.status(400).json({ error: 'Input directory not found' });
      return;
    }

    if (!fs.statSync(inputPath).isDirectory()) {
      res.status(400).json({ error: 'Input path is not a directory' });
      return;
    }

    const isValid = await verifyMasterPassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const masterKey = await getMasterKey(password);
    const outDir = outputPath || inputPath + '.encrypted';

    const result = await encryptDirectory(
      inputPath,
      outDir,
      masterKey,
      (progress: DirectoryProgress) => {
        broadcastProgress({
          type: 'encrypt-dir',
          ...progress,
        });
      }
    );

    logger.info(`Directory encrypted via web UI: ${inputPath}`);
    res.json({ success: true, result });
  } catch (error) {
    logger.error(`Directory encrypt failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/decrypt-dir', async (req, res) => {
  try {
    const { password, inputPath, outputPath } = req.body;

    if (!password || !inputPath) {
      res.status(400).json({ error: 'Password and inputPath are required' });
      return;
    }

    if (!fs.existsSync(inputPath)) {
      res.status(400).json({ error: 'Input directory not found' });
      return;
    }

    if (!fs.statSync(inputPath).isDirectory()) {
      res.status(400).json({ error: 'Input path is not a directory' });
      return;
    }

    const isValid = await verifyMasterPassword(password);
    if (!isValid) {
      res.status(401).json({ error: 'Invalid password' });
      return;
    }

    const masterKey = await getMasterKey(password);
    const outDir = outputPath || inputPath + '.decrypted';

    const result = await decryptDirectory(
      inputPath,
      outDir,
      masterKey,
      (progress: DirectoryProgress) => {
        broadcastProgress({
          type: 'decrypt-dir',
          ...progress,
        });
      }
    );

    logger.info(`Directory decrypted via web UI: ${inputPath}`);
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
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileBuffer = fs.readFileSync(req.file.path);

    if (fileBuffer.length < 148) {
      res.status(400).json({ error: 'File too small to be a valid encrypted file' });
      fs.unlinkSync(req.file.path);
      return;
    }

    const magic = fileBuffer.subarray(0, 6).toString();
    const isValidMagic = magic === 'SCRYPT';

    const fileSize = fileBuffer.length;
    const headerSize = 128;
    const authTagSize = 16;
    const hasAuthTag = fileSize > headerSize + authTagSize;

    fs.unlinkSync(req.file.path);

    res.json({
      valid: isValidMagic,
      isEncryptedFile: isValidMagic,
      hasAuthTag,
      fileSize,
      message: isValidMagic
        ? 'File appears to be a valid SecureCrypt encrypted file'
        : 'File is not a SecureCrypt encrypted file',
    });
  } catch (error) {
    logger.error(`Verify failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as apiRoutes };
