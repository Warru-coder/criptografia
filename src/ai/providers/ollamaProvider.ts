const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b-instruct-q4_K_M';
const FETCH_TIMEOUT_MS = 30_000;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaResponse {
  choices: Array<{ message: { content: string } }>;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function isOllamaAvailable(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `${OLLAMA_BASE_URL}/models`,
      { method: 'GET' },
      5_000
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function chat(messages: ChatMessage[], systemPrompt?: string): Promise<string> {
  const all: ChatMessage[] = systemPrompt
    ? [{ role: 'system', content: systemPrompt }, ...messages]
    : messages;

  const res = await fetchWithTimeout(
    `${OLLAMA_BASE_URL}/chat/completions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages: all, stream: false, temperature: 0.2 }),
    },
    FETCH_TIMEOUT_MS
  );

  if (!res.ok) {
    throw new Error(`Ollama API error ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as OllamaResponse;
  return data.choices[0].message.content.trim();
}

export { OLLAMA_MODEL };
