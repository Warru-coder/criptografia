import express from 'express';
import { auditConfig, CryptoConfig } from '../../ai/services/configAuditor';
import { askAssistant, ChatMessage } from '../../ai/services/cryptoAssistant';
import { isOllamaAvailable, OLLAMA_MODEL } from '../../ai/providers/ollamaProvider';
import { requireSession } from '../middleware/requireSession';
import { logger } from '../../utils/logger';

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
    logger.error(`AI chat failed: ${(error as Error).message}`);
    res.status(500).json({ error: (error as Error).message });
  }
});

export { router as aiRoutes };
