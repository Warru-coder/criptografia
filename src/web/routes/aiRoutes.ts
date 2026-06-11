import express from 'express';
import { auditConfig, CryptoConfig } from '../../ai/services/configAuditor';
import { askAssistant, ChatMessage } from '../../ai/services/cryptoAssistant';
import { classifyFile } from '../../ai/services/fileClassifier';
import { chat, isOllamaAvailable, OLLAMA_MODEL } from '../../ai/providers/ollamaProvider';
import { requireSession } from '../middleware/requireSession';
import { logger } from '../../utils/logger';

interface ActivityEntry {
  timestamp: string;
  action: string;
  filename: string;
  status: string;
}

const router = express.Router();

router.get('/status', async (_req, res) => {
  const available = await isOllamaAvailable();
  res.json({ available, model: OLLAMA_MODEL, mode: available ? 'local-llm' : 'template' });
});

router.post('/audit', requireSession, async (req, res) => {
  try {
    const config = req.body as CryptoConfig;

    if (!config || typeof config !== 'object') {
      res.status(400).json({ error: 'Request body must be a valid CryptoConfig JSON object' });
      return;
    }

    const result = await auditConfig(config);
    logger.info(`Config audit completed — risk: ${result.riskLevel}, score: ${result.score}`);
    res.json(result);
  } catch (error) {
    logger.error(`AI audit failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

router.post('/chat', requireSession, async (req, res) => {
  try {
    const { message, history } = req.body as { message: string; history?: ChatMessage[] };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    if (message.length > 1000) {
      res.status(400).json({ error: 'message too long (max 1000 chars)' });
      return;
    }

    const safeHistory = Array.isArray(history) ? history.slice(-10) : [];

    const response = await askAssistant(message.trim(), safeHistory);
    res.json(response);
  } catch (error) {
    const msg = (error as Error).message ?? '';
    const isTimeout = msg.includes('aborted') || msg.includes('abort') || msg.includes('timeout');
    logger.error(`AI chat failed: ${msg}`);
    res.status(500).json({
      error: isTimeout
        ? 'Ollama tardó demasiado en responder. Prueba con una pregunta más corta o espera a que el modelo termine de cargar.'
        : msg,
    });
  }
});

router.post('/summarize-activity', requireSession, async (req, res) => {
  try {
    const { entries } = req.body as { entries: unknown };

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries must be a non-empty array' });
      return;
    }

    const asString = (value: unknown, maxLength: number): string =>
      typeof value === 'string' ? value.slice(0, maxLength) : '';

    const safeEntries: ActivityEntry[] = (entries as unknown[])
      .slice(-50)
      .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
      .map(e => ({
        timestamp: asString(e.timestamp, 40),
        action: asString(e.action, 60),
        filename: asString(e.filename, 160),
        status: asString(e.status, 40),
      }));

    if (safeEntries.length === 0) {
      res.status(400).json({ error: 'entries must contain valid activity objects' });
      return;
    }

    const logLines = safeEntries
      .map(e => `${e.timestamp} | ${e.action} | ${e.filename} | ${e.status}`)
      .join('\n');

    const available = await isOllamaAvailable();
    if (!available) {
      res.status(503).json({ error: 'Ollama no está disponible. Inicia Ollama para usar esta función.' });
      return;
    }

    const prompt = `Eres el asistente de SecureCrypt. Dado el siguiente registro de actividad, genera un resumen en lenguaje natural, conciso (2-4 frases), destacando patrones importantes como archivos cifrados, errores o intentos fallidos.

Registro:
${logLines}

Resumen:`;

    const summary = await chat([{ role: 'user', content: prompt }]);
    logger.info(`Activity summary generated for ${safeEntries.length} entries`);
    res.json({ summary: summary.trim() });
  } catch (error) {
    const msg = (error as Error).message ?? '';
    const isTimeout = msg.includes('aborted') || msg.includes('abort') || msg.includes('timeout');
    logger.error(`Activity summary failed: ${msg}`);
    res.status(500).json({
      error: isTimeout
        ? 'Ollama tardó demasiado en responder. Prueba con menos entradas o espera a que el modelo termine de cargar.'
        : msg,
    });
  }
});

router.post('/classify-file', requireSession, async (req, res) => {
  try {
    const { filename, sizeBytes, mimeType } = req.body as {
      filename: unknown;
      sizeBytes: unknown;
      mimeType?: unknown;
    };

    if (typeof filename !== 'string' || filename.trim().length === 0) {
      res.status(400).json({ error: 'filename is required' });
      return;
    }
    if (typeof sizeBytes !== 'number' || sizeBytes < 0) {
      res.status(400).json({ error: 'sizeBytes must be a non-negative number' });
      return;
    }

    const result = await classifyFile(
      filename.trim().slice(0, 255),
      sizeBytes,
      typeof mimeType === 'string' ? mimeType.slice(0, 100) : undefined
    );

    res.json(result);
  } catch (error) {
    logger.error(`File classify failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as aiRoutes };
