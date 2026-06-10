import { chat, isOllamaAvailable, OLLAMA_MODEL } from '../providers/ollamaProvider';
import { searchKnowledge, KnowledgeChunk } from '../knowledge/cryptoKnowledge';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  answer: string;
  sources: Array<{ id: string; title: string; source: string }>;
  usedAI: boolean;
  model?: string;
}

const SYSTEM_PROMPT = `Eres CryptoAdvisor, un asistente experto en criptografía aplicada y seguridad de software.
Respondes siempre en español. Eres preciso, técnico y citas estándares reales (NIST, OWASP, RFC).
SOLO responde preguntas sobre criptografía, seguridad de datos y temas relacionados.
Si la pregunta no es sobre criptografía o seguridad, responde: "Solo puedo ayudarte con preguntas sobre criptografía y seguridad de datos."
Usa los fragmentos de documentación proporcionados como base para tu respuesta.
Al final, si mencionas un estándar, indica la referencia entre corchetes [NIST SP 800-38D].`;

function buildContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) return '';
  return chunks
    .map(c => `[${c.id}] ${c.title}\n${c.content}\nFuente: ${c.source}`)
    .join('\n\n---\n\n');
}

function templateAnswer(question: string, chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return `No encontré documentación específica sobre "${question}" en la base de conocimiento. Te recomiendo consultar OWASP Cryptographic Storage Cheat Sheet o NIST SP 800-175B para respuestas detalladas.`;
  }

  const topChunk = chunks[0];
  return `Basándome en la documentación disponible:\n\n**${topChunk.title}**\n\n${topChunk.content}\n\n*Fuente: ${topChunk.source}*`;
}

export async function askAssistant(
  question: string,
  history: ChatMessage[] = []
): Promise<AssistantResponse> {
  const relevantChunks = searchKnowledge(question, 3);
  const sources = relevantChunks.map(c => ({ id: c.id, title: c.title, source: c.source }));

  const ollamaOk = await isOllamaAvailable();

  if (!ollamaOk) {
    return {
      answer: templateAnswer(question, relevantChunks),
      sources,
      usedAI: false,
    };
  }

  const context = buildContext(relevantChunks);
  const contextBlock = context ? `\n\nDocumentación de referencia:\n${context}\n\n` : '';

  const messages = [
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    {
      role: 'user' as const,
      content: `${contextBlock}Pregunta: ${question}`,
    },
  ];

  const answer = await chat(messages, SYSTEM_PROMPT);

  return {
    answer,
    sources,
    usedAI: true,
    model: OLLAMA_MODEL,
  };
}
