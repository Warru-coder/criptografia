import { chat, isOllamaAvailable } from '../providers/ollamaProvider';

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface CryptoConfig {
  algorithm?: string;
  kdf?: string;
  kdfParams?: {
    memoryCost?: number;
    timeCost?: number;
    parallelism?: number;
    iterations?: number;
    hashFunction?: string;
  };
  keyLength?: number;
  ivLength?: number;
  tagLength?: number;
  saltLength?: number;
}

export interface Finding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  reference: string;
  currentValue?: string;
  expectedValue?: string;
  explanation?: string;
}

export interface AuditResult {
  riskLevel: RiskLevel;
  score: number;
  findings: Finding[];
  compliantWith: string[];
  summary: string;
  aiAnalysis?: string;
  checkedAt: string;
}

interface Rule {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  reference: string;
  check: (config: CryptoConfig) => { pass: boolean; currentValue?: string; expectedValue?: string };
}

const RULES: Rule[] = [
  {
    id: 'ALG-001',
    severity: 'critical',
    title: 'Algoritmo de cifrado inseguro',
    description: 'Solo AES-256-GCM proporciona cifrado autenticado (AEAD) con 256 bits de seguridad.',
    recommendation: 'Usar AES-256-GCM. Evitar AES-128 (menor margen de seguridad), CBC (sin autenticación), ECB (patrones visibles).',
    reference: 'NIST SP 800-38D',
    check: (c) => ({
      pass: !c.algorithm || c.algorithm.toUpperCase() === 'AES-256-GCM',
      currentValue: c.algorithm,
      expectedValue: 'AES-256-GCM',
    }),
  },
  {
    id: 'KDF-001',
    severity: 'high',
    title: 'KDF no es Argon2id',
    description: 'PBKDF2, bcrypt y MD5 son más vulnerables a ataques GPU que Argon2id. OWASP 2024 recomienda Argon2id.',
    recommendation: 'Migrar a Argon2id (memory-hard KDF). Si no es posible, usar PBKDF2-HMAC-SHA256 con ≥600.000 iteraciones.',
    reference: 'OWASP Password Storage Cheat Sheet 2024',
    check: (c) => ({
      pass: !c.kdf || c.kdf.toLowerCase().includes('argon2'),
      currentValue: c.kdf,
      expectedValue: 'argon2id',
    }),
  },
  {
    id: 'KDF-002',
    severity: 'high',
    title: 'memoryCost de Argon2id insuficiente',
    description: 'Un memoryCost bajo hace que Argon2id sea prácticamente tan débil como PBKDF2. Mínimo OWASP: 19.456 KB.',
    recommendation: 'Establecer memoryCost ≥ 19.456 KB (mínimo OWASP) o ≥ 65.536 KB para alta seguridad.',
    reference: 'OWASP Password Storage Cheat Sheet 2024, RFC 9106',
    check: (c) => {
      if (!c.kdf?.toLowerCase().includes('argon2') || !c.kdfParams?.memoryCost) return { pass: true };
      const ok = c.kdfParams.memoryCost >= 19456;
      return { pass: ok, currentValue: `${c.kdfParams.memoryCost} KB`, expectedValue: '≥ 19.456 KB' };
    },
  },
  {
    id: 'KDF-003',
    severity: 'medium',
    title: 'timeCost de Argon2id insuficiente',
    description: 'timeCost=1 es el mínimo absoluto. OWASP recomienda ≥ 2 para datos sensibles.',
    recommendation: 'Establecer timeCost ≥ 2 (recomendado 3 para alta seguridad).',
    reference: 'OWASP Password Storage Cheat Sheet 2024',
    check: (c) => {
      if (!c.kdf?.toLowerCase().includes('argon2') || !c.kdfParams?.timeCost) return { pass: true };
      const ok = c.kdfParams.timeCost >= 2;
      return { pass: ok, currentValue: String(c.kdfParams.timeCost), expectedValue: '≥ 2' };
    },
  },
  {
    id: 'KDF-004',
    severity: 'critical',
    title: 'Iteraciones PBKDF2 insuficientes',
    description: 'PBKDF2 con pocas iteraciones es vulnerable a ataques de fuerza bruta con GPUs modernas.',
    recommendation: 'PBKDF2-HMAC-SHA256: ≥ 600.000 iteraciones (OWASP 2024). PBKDF2-HMAC-SHA512: ≥ 210.000.',
    reference: 'OWASP Password Storage Cheat Sheet 2024, RFC 8018',
    check: (c) => {
      if (!c.kdf?.toLowerCase().includes('pbkdf2') || !c.kdfParams?.iterations) return { pass: true };
      const min = c.kdfParams.hashFunction?.includes('512') ? 210000 : 600000;
      const ok = c.kdfParams.iterations >= min;
      return { pass: ok, currentValue: String(c.kdfParams.iterations), expectedValue: `≥ ${min}` };
    },
  },
  {
    id: 'KEY-001',
    severity: 'high',
    title: 'Longitud de clave insuficiente',
    description: 'AES-128 tiene un margen de seguridad reducido frente a ataques cuánticos futuros. AES-256 es el estándar recomendado.',
    recommendation: 'Usar clave de 256 bits (32 bytes).',
    reference: 'NIST SP 800-57, NIST Post-Quantum guidance',
    check: (c) => {
      if (!c.keyLength) return { pass: true };
      const ok = c.keyLength >= 32;
      return { pass: ok, currentValue: `${c.keyLength} bytes (${c.keyLength * 8} bits)`, expectedValue: '32 bytes (256 bits)' };
    },
  },
  {
    id: 'IV-001',
    severity: 'high',
    title: 'IV/Nonce demasiado corto',
    description: 'IVs cortos aumentan la probabilidad de colisión (birthday paradox). Para GCM, mínimo 12 bytes.',
    recommendation: 'Usar IV de al menos 12 bytes (96 bits) generado aleatoriamente por operación.',
    reference: 'NIST SP 800-38D, RFC 5116',
    check: (c) => {
      if (!c.ivLength) return { pass: true };
      const ok = c.ivLength >= 12;
      return { pass: ok, currentValue: `${c.ivLength} bytes`, expectedValue: '≥ 12 bytes' };
    },
  },
  {
    id: 'TAG-001',
    severity: 'high',
    title: 'Authentication tag reducido',
    description: 'Tags de menos de 128 bits reducen la protección contra forgery attacks.',
    recommendation: 'Usar authentication tag de 128 bits (16 bytes), el máximo disponible en GCM.',
    reference: 'NIST SP 800-38D',
    check: (c) => {
      if (!c.tagLength) return { pass: true };
      const ok = c.tagLength >= 16;
      return { pass: ok, currentValue: `${c.tagLength} bytes`, expectedValue: '16 bytes (128 bits)' };
    },
  },
  {
    id: 'SALT-001',
    severity: 'medium',
    title: 'Salt demasiado corto',
    description: 'Un salt menor a 128 bits aumenta el riesgo de colisión y reduce la efectividad contra rainbow tables.',
    recommendation: 'Usar salt de al menos 16 bytes (128 bits) generado aleatoriamente.',
    reference: 'NIST SP 800-132',
    check: (c) => {
      if (!c.saltLength) return { pass: true };
      const ok = c.saltLength >= 16;
      return { pass: ok, currentValue: `${c.saltLength} bytes`, expectedValue: '≥ 16 bytes' };
    },
  },
];

function computeScore(findings: Finding[]): number {
  let deductions = 0;
  for (const f of findings) {
    if (f.severity === 'critical') deductions += 40;
    else if (f.severity === 'high') deductions += 20;
    else if (f.severity === 'medium') deductions += 10;
    else if (f.severity === 'low') deductions += 5;
  }
  return Math.max(0, 100 - deductions);
}

function scoreToRisk(score: number): RiskLevel {
  if (score >= 85) return 'low';
  if (score >= 65) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

async function enrichFindingsWithExplanations(findings: Finding[]): Promise<void> {
  const systemPrompt = `Eres un experto en criptografía. Para cada hallazgo de seguridad, explica en 2-3 frases concisas el riesgo real para el mundo real (ataques concretos, consecuencias prácticas). Responde en español. Sé directo y técnico.`;

  const list = findings
    .map(f => `ID: ${f.id}\nHallazgo: ${f.title}\nDescripción técnica: ${f.description}\nValor actual: ${f.currentValue ?? 'no especificado'}`)
    .join('\n\n---\n\n');

  const prompt = `Para cada uno de los siguientes hallazgos de seguridad, genera una explicación del riesgo real en 2-3 frases. Formato de respuesta: devuelve exactamente un bloque JSON con la estructura: {"explicaciones": [{"id": "<ID>", "explicacion": "<texto>"}]}\n\nHallazgos:\n${list}`;

  try {
    const raw = await chat([{ role: 'user', content: prompt }], systemPrompt);
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const parsed = JSON.parse(jsonMatch[0]) as { explicaciones: Array<{ id: string; explicacion: string }> };
    const map = new Map(parsed.explicaciones.map(e => [e.id, e.explicacion]));

    for (const finding of findings) {
      const expl = map.get(finding.id);
      if (expl) finding.explanation = expl;
    }
  } catch {
    // explanations are optional — silently ignore failures
  }
}

export async function auditConfig(config: CryptoConfig): Promise<AuditResult> {
  const findings: Finding[] = [];

  for (const rule of RULES) {
    const { pass, currentValue, expectedValue } = rule.check(config);
    if (!pass) {
      findings.push({
        id: rule.id,
        severity: rule.severity,
        title: rule.title,
        description: rule.description,
        recommendation: rule.recommendation,
        reference: rule.reference,
        currentValue,
        expectedValue,
      });
    }
  }

  const score = computeScore(findings);
  const riskLevel = scoreToRisk(score);

  const compliantWith: string[] = [];
  if (score >= 85) {
    compliantWith.push('OWASP Password Storage Cheat Sheet 2024');
    compliantWith.push('NIST SP 800-38D');
    compliantWith.push('GDPR Art. 32 (medidas técnicas adecuadas)');
  }

  let summary: string;
  if (findings.length === 0) {
    summary = `La configuración cumple con todas las recomendaciones OWASP/NIST. Puntuación: ${score}/100.`;
  } else {
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    summary = `Se detectaron ${findings.length} hallazgo(s): ${critical} crítico(s), ${high} alto(s). Puntuación: ${score}/100.`;
  }

  let aiAnalysis: string | undefined;
  if (await isOllamaAvailable()) {
    const systemPrompt = `Eres un experto en criptografía y seguridad de software. Tu rol es explicar de forma clara y concisa los hallazgos de seguridad en configuraciones criptográficas. Responde siempre en español. Sé técnico pero accesible. Máximo 3-4 frases.`;

    const findingsSummary =
      findings.length === 0
        ? 'No se encontraron vulnerabilidades. La configuración es segura.'
        : findings.map(f => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`).join('\n');

    const userMessage = `Configuración auditada: ${JSON.stringify(config, null, 2)}\n\nHallazgos:\n${findingsSummary}\n\nProporciona un análisis ejecutivo de 3-4 frases.`;

    try {
      aiAnalysis = await chat([{ role: 'user', content: userMessage }], systemPrompt);
    } catch {
      aiAnalysis = undefined;
    }

    if (findings.length > 0) {
      await enrichFindingsWithExplanations(findings);
    }
  }

  return {
    riskLevel,
    score,
    findings,
    compliantWith,
    summary,
    aiAnalysis,
    checkedAt: new Date().toISOString(),
  };
}
