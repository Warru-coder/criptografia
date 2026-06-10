# Capítulo 6: Integración del Asistente Inteligente

## 6.1 Diseño del sistema RAG

### 6.1.1 Motivación del enfoque RAG

Los LLMs de propósito general tienen varias limitaciones para el dominio de criptografía aplicada:

1. **Alucinaciones**: pueden inventar parámetros de seguridad incorrectos (ej. "usa bcrypt con 12 rondas" en lugar de "usa Argon2id con memoryCost=65536")
2. **Conocimiento desactualizado**: los estándares OWASP se actualizan periódicamente
3. **Falta de precisión en referencias**: citan RFC, NIST SP o OWASP sin los números exactos

RAG resuelve estos problemas anclando las respuestas a documentos verificados y actualizables.

### 6.1.2 Arquitectura del pipeline RAG

```
┌───────────────────────────────────────────────────────────┐
│                   Knowledge Base                          │
│  15 chunks  ·  NIST / OWASP / RFC  ·  verificados        │
└─────────────────────────┬─────────────────────────────────┘
                          │ Indexado en memoria (startup)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Retrieval (TF-IDF keyword search)             │
│  query → tokenize → score chunks → top-3                    │
└─────────────────────────┬───────────────────────────────────┘
                          │ chunks seleccionados
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Context Builder                               │
│  "[id] título\ncontenido\nFuente: ..."                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ contexto estructurado
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               LLM (Ollama local)                            │
│  SYSTEM: CryptoAdvisor, responde en español, cita estándares│
│  USER: [contexto] + Pregunta: {query}                       │
│  → temperatura 0.2 (respuestas consistentes y técnicas)     │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
                  AssistantResponse {
                    answer: string,
                    sources: [{id, title, source}],
                    usedAI: boolean,
                    model?: string
                  }
```

## 6.2 Base de conocimiento (src/ai/knowledge/)

### 6.2.1 Estructura de un chunk

```typescript
interface KnowledgeChunk {
  id: string;       // 'aes-gcm-001'
  title: string;    // 'AES-256-GCM: Cifrado Autenticado'
  content: string;  // Contenido técnico verificado
  source: string;   // 'NIST SP 800-38D'
  tags: string[];   // ['aes', 'gcm', 'cipher', 'nist', 'aead']
}
```

### 6.2.2 Chunks de la base de conocimiento

| ID | Título | Fuente | Tags clave |
|----|--------|--------|-----------|
| aes-gcm-001 | AES-256-GCM: Cifrado Autenticado | NIST SP 800-38D | aes, gcm, aead |
| aes-modes-001 | Modos de cifrado AES: Comparativa | NIST SP 800-38A | ecb, cbc, ctr |
| argon2id-001 | Argon2id: KDF Memory-Hard | RFC 9106, OWASP 2024 | argon2, kdf |
| pbkdf2-001 | PBKDF2: Iteraciones y seguridad | RFC 8018, OWASP 2024 | pbkdf2, iterations |
| iv-nonce-001 | IV/Nonce: generación y reutilización | NIST SP 800-38D | iv, nonce |
| salt-001 | Salt: función y longitud mínima | NIST SP 800-132 | salt, rainbow |
| auth-tag-001 | Authentication Tag GCM | NIST SP 800-38D | tag, forgery |
| timing-attack-001 | Timing Attacks en comparación de hashes | OWASP ASVS 4.0 | timing, hmac |
| path-traversal-001 | Path Traversal: validación de rutas | OWASP Top 10 | path, traversal |
| key-management-001 | Gestión del ciclo de vida de claves | NIST SP 800-57 | key, lifecycle |
| streaming-encryption-001 | Cifrado en streaming de archivos grandes | NIST SP 800-38D | streaming |
| secure-random-001 | Generación de bytes aleatorios seguros | NIST SP 800-90A | random, csprng |
| owasp-asvs-001 | OWASP ASVS 4.0: Controles criptográficos | OWASP ASVS 4.0 | asvs, compliance |
| gdpr-encryption-001 | GDPR Art. 32: Cifrado como medida técnica | GDPR | gdpr, compliance |
| format-scrypt-001 | Formato .scrypt: especificación | SecureCrypt TFM | format, header |

### 6.2.3 Algoritmo TF-IDF para recuperación

```typescript
// src/ai/knowledge/cryptoKnowledge.ts — versión simplificada
function scoreChunk(query: string[], chunk: KnowledgeChunk): number {
  const tokens = [...chunk.title.toLowerCase().split(/\W+/),
                  ...chunk.content.toLowerCase().split(/\W+/),
                  ...chunk.tags];
  let score = 0;
  for (const qt of query) {
    const tf = tokens.filter(t => t === qt).length / tokens.length;
    const df = chunks.filter(c => c.tags.includes(qt) || c.title.toLowerCase().includes(qt)).length;
    const idf = Math.log(chunks.length / (1 + df));
    score += tf * idf;
  }
  return score;
}

export function searchKnowledge(query: string, topK = 3): KnowledgeChunk[] {
  const queryTokens = query.toLowerCase().split(/\W+/).filter(t => t.length > 2);
  return chunks
    .map(c => ({ chunk: c, score: scoreChunk(queryTokens, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(r => r.chunk);
}
```

**Limitaciones del enfoque keyword**: La búsqueda TF-IDF es eficiente pero semánticamente limitada. Una extensión futura usaría embeddings vectoriales (sentence-transformers) para búsqueda semántica más precisa.

## 6.3 Proveedor Ollama (src/ai/providers/)

### 6.3.1 Configuración

```typescript
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b-instruct-q4_K_M';
const FETCH_TIMEOUT_MS = 30_000;
```

El endpoint `/v1` usa la API compatible con OpenAI, lo que permite cambiar el provider a cualquier servicio compatible (OpenAI, Groq, Azure OpenAI) con solo cambiar la variable de entorno.

### 6.3.2 Fallback graceful

Si Ollama no está disponible (timeout en 5 segundos), el sistema cae automáticamente al modo template:

```typescript
// cryptoAssistant.ts
if (!ollamaOk) {
  return {
    answer: templateAnswer(question, relevantChunks),
    sources,
    usedAI: false,
  };
}
```

**El modo template** devuelve directamente el contenido del chunk más relevante, sin generación de LLM. Es determinista, instantáneo, y siempre correcto (basado en documentación verificada).

## 6.4 Auditor de configuración (src/ai/services/configAuditor.ts)

### 6.4.1 Reglas implementadas

| ID | Severidad | Campo auditado | Condición de fallo |
|----|-----------|---------------|-------------------|
| ALG-001 | CRITICAL | algorithm | ≠ 'AES-256-GCM' |
| KDF-001 | HIGH | kdf | no contiene 'argon2' |
| KDF-002 | HIGH | kdfParams.memoryCost | < 19.456 KB |
| KDF-003 | MEDIUM | kdfParams.timeCost | < 2 |
| KDF-004 | CRITICAL | kdfParams.iterations | < 600.000 (PBKDF2) |
| KEY-001 | HIGH | keyLength | < 32 bytes |
| IV-001 | HIGH | ivLength | < 12 bytes |
| TAG-001 | HIGH | tagLength | < 16 bytes |
| SALT-001 | MEDIUM | saltLength | < 16 bytes |

### 6.4.2 Puntuación de riesgo

```typescript
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
```

| Score | Risk Level | Interpretación |
|-------|-----------|----------------|
| 85-100 | LOW | Conforme con OWASP/NIST |
| 65-84 | MEDIUM | Mejoras recomendadas |
| 40-64 | HIGH | Vulnerabilidades significativas |
| 0-39 | CRITICAL | No usar en producción |

### 6.4.3 Análisis LLM opcional

Si Ollama está disponible, el auditor genera un análisis ejecutivo de 3-4 frases en español que resume los hallazgos de forma accesible para equipos no especializados.

## 6.5 Evaluación del sistema RAG

### 6.5.1 Metodología de evaluación

Para evaluar la calidad del sistema RAG, se diseñaron 50 preguntas de prueba en 5 categorías:

| Categoría | N | Ejemplo |
|-----------|---|---------|
| Algoritmos | 10 | "¿Por qué no usar AES-128-CBC?" |
| KDF y contraseñas | 10 | "¿Cuántas iteraciones necesita PBKDF2?" |
| IV y salt | 10 | "¿Qué pasa si reutilizo el nonce en GCM?" |
| Vulnerabilidades | 10 | "¿Cómo prevenir path traversal?" |
| Cumplimiento | 10 | "¿Qué exige GDPR Art. 32 sobre cifrado?" |

### 6.5.2 Resultados

Los resultados completos se encuentran en `tfm/experimentos/EXP-003_ai_audit_accuracy.md` y `EXP-004_rag_retrieval_quality.md`.

**Auditor de configuración (EXP-003)**:

| Métrica | Valor |
|---------|-------|
| Precisión (TP / (TP + FP)) | **100%** |
| Recall (TP / (TP + FN)) | **100%** |
| F1-Score | **1,000** |
| Dataset | 10 configs (2 seguras + 8 vulnerables) |

**Sistema RAG TF-IDF (EXP-004)**:

| Categoría | Precision@3 | Recall@3 |
|-----------|------------|---------|
| AES/modos | 0,93 | 0,88 |
| KDF | 0,97 | 0,95 |
| IV/salt | 0,90 | 0,87 |
| Vulnerabilidades | 0,87 | 0,82 |
| Cumplimiento normativo | 0,83 | 0,78 |
| **TOTAL** | **0,90** | **0,86** |

## 6.6 Consideraciones de privacidad

El sistema AI de SecureCrypt está diseñado para **no enviar información sensible a servicios externos**:

- El auditor de configuración recibe JSON con parámetros técnicos, nunca datos de usuario
- El chat assistant recibe preguntas sobre criptografía, nunca archivos o claves
- Ollama se ejecuta localmente: las consultas nunca abandonan el servidor
- Si Ollama no está disponible, se usa el modo template (sin red)

Este diseño es especialmente relevante para organizaciones con políticas de datos estrictas o entornos air-gapped.
