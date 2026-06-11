import { env } from '../../config';

export type FileCategory =
  | 'FINANCIERO'
  | 'PERSONAL'
  | 'CREDENCIALES'
  | 'TRABAJO'
  | 'MULTIMEDIA'
  | 'OTRO';

export interface ClassifyResult {
  available: true;
  category: FileCategory;
  sensitive: boolean;
  confidence: number;
  reason: string;
  recommendation: string;
}

export interface ClassifyUnavailable {
  available: false;
}

export type ClassifyResponse = ClassifyResult | ClassifyUnavailable;

const CATEGORIES: FileCategory[] = [
  'FINANCIERO', 'PERSONAL', 'CREDENCIALES', 'TRABAJO', 'MULTIMEDIA', 'OTRO',
];

function buildPrompt(filename: string, sizeBytes: number, mimeType?: string): string {
  const ext = filename.includes('.') ? filename.split('.').pop()!.toLowerCase() : 'unknown';
  const sizeFmt = sizeBytes < 1024
    ? `${sizeBytes} B`
    : sizeBytes < 1_048_576
    ? `${(sizeBytes / 1024).toFixed(1)} KB`
    : `${(sizeBytes / 1_048_576).toFixed(1)} MB`;

  return `You are a file security classifier. Classify the following file based ONLY on its metadata (never its content).

File metadata:
- Name: ${filename}
- Extension: .${ext}
- Size: ${sizeFmt}${mimeType ? `\n- MIME type: ${mimeType}` : ''}

Valid categories: ${CATEGORIES.join(', ')}

Respond with ONLY a JSON object, no other text:
{
  "category": "<one of the valid categories>",
  "sensitive": <true if the file likely contains sensitive data, false otherwise>,
  "confidence": <number between 0 and 1>,
  "reason": "<one sentence explaining the classification>",
  "recommendation": "<one sentence on how to handle this file securely>"
}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

export async function classifyFile(
  filename: string,
  sizeBytes: number,
  mimeType?: string
): Promise<ClassifyResponse> {
  try {
    const healthRes = await fetchWithTimeout(`${env.ollamaBaseUrl}/models`, { method: 'GET' }, 3_000);
    if (!healthRes.ok) return { available: false };

    const prompt = buildPrompt(filename, sizeBytes, mimeType);

    const res = await fetchWithTimeout(
      `${env.ollamaBaseUrl}/chat/completions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.ollamaModel,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          temperature: 0.1,
        }),
      },
      10_000
    );

    if (!res.ok) return { available: false };

    const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
    const raw = data.choices[0].message.content.trim();

    // Extract JSON even if the model wraps it in markdown fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { available: false };

    const parsed = JSON.parse(jsonMatch[0]) as Partial<ClassifyResult>;

    const category: FileCategory = CATEGORIES.includes(parsed.category as FileCategory)
      ? (parsed.category as FileCategory)
      : 'OTRO';

    return {
      available: true,
      category,
      sensitive: parsed.sensitive === true,
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0.5,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 200) : '',
      recommendation: typeof parsed.recommendation === 'string'
        ? parsed.recommendation.slice(0, 200)
        : '',
    };
  } catch {
    return { available: false };
  }
}
