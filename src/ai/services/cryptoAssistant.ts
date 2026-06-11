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

const SYSTEM_PROMPT = `Eres el asistente de seguridad de SecureCrypt, una herramienta de cifrado multiplataforma.

Contexto del proyecto:
- Cifrado: AES-256-GCM (streaming, con authTag verificado antes de devolver datos)
- KDF: Argon2id en Node.js (memoryCost=65536 KB, timeCost=3, parallelism=2); PBKDF2-HMAC-SHA256 con 600.000 iteraciones en Windows (CNG BCryptDeriveKeyPBKDF2) y Android (SecretKeyFactory). Unificación en Argon2id pendiente (ADR-001)
- IV y salt: 16 bytes aleatorios únicos por operación
- Formato de archivo: .scrypt (cabecera: MAGIC 6B + VER 1B + PARAMS + SALT 32B + IV 12B, luego ciphertext + TAG 16B)
- Plataformas: CLI/Web (Node.js/TypeScript), Windows C++20 (CNG/BCrypt), Android Kotlin (Jetpack Compose + Android Keystore)
- Autenticación: contraseña (Argon2id) + passkeys FIDO2/WebAuthn

Comportamiento:
- Sé conciso y técnico; no repitas puntos ya mencionados en la conversación
- Responde en el idioma del usuario (si escribe en español, responde en español; si en inglés, en inglés)
- Cita estándares reales cuando sea relevante: NIST SP 800-38D, OWASP Cheat Sheets, RFC 9106 (Argon2)
- SOLO responde preguntas sobre criptografía, seguridad de datos y el propio proyecto SecureCrypt
- Si la pregunta no es sobre esos temas, responde: "Solo puedo ayudarte con preguntas sobre criptografía y seguridad de datos."
- Usa los fragmentos de documentación proporcionados como base; al citar un estándar, indica la referencia entre corchetes [NIST SP 800-38D]`;

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
    ...history.map(m => ({ role: m.role, content: m.content })),
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
