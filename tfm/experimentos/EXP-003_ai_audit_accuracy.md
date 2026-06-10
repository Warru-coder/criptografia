# EXP-003: Precisión del Auditor de Configuración

**Estado**: Pendiente de ejecución  
**Capítulo relacionado**: 8.4

## Objetivo

Evaluar la precisión del auditor de configuración en detectar vulnerabilidades criptográficas conocidas y clasificarlas con la severidad correcta.

## Dataset de prueba

### Configuraciones seguras (10 casos — esperado: 0 hallazgos)

```json
[
  { "algorithm": "AES-256-GCM", "kdf": "argon2id", "kdfParams": { "memoryCost": 65536, "timeCost": 3, "parallelism": 2 }, "keyLength": 32, "ivLength": 12, "tagLength": 16, "saltLength": 32 },
  { "algorithm": "AES-256-GCM", "kdf": "argon2id", "kdfParams": { "memoryCost": 19456, "timeCost": 2, "parallelism": 1 }, "keyLength": 32, "ivLength": 12, "tagLength": 16, "saltLength": 16 },
  { "algorithm": "AES-256-GCM", "kdf": "argon2id", "kdfParams": { "memoryCost": 131072, "timeCost": 4, "parallelism": 4 }, "keyLength": 32, "ivLength": 12, "tagLength": 16, "saltLength": 32 }
]
```

### Configuraciones con vulnerabilidades conocidas

| Caso | Config | Vulnerabilidad esperada | Severidad esperada |
|------|--------|------------------------|-------------------|
| V01 | algorithm: "AES-128-CBC" | ALG-001 | CRITICAL |
| V02 | algorithm: "AES-128-GCM" | ALG-001 + KEY-001 | CRITICAL + HIGH |
| V03 | kdf: "pbkdf2", iterations: 10000 | KDF-001 + KDF-004 | HIGH + CRITICAL |
| V04 | kdf: "bcrypt" | KDF-001 | HIGH |
| V05 | kdf: "argon2id", memoryCost: 4096 | KDF-002 | HIGH |
| V06 | kdf: "argon2id", timeCost: 1 | KDF-003 | MEDIUM |
| V07 | keyLength: 16 (128 bits) | KEY-001 | HIGH |
| V08 | ivLength: 8 | IV-001 | HIGH |
| V09 | tagLength: 12 | TAG-001 | HIGH |
| V10 | saltLength: 8 | SALT-001 | MEDIUM |

### Configuraciones críticas (múltiples vulnerabilidades)

| Caso | Config resumida | Score esperado |
|------|----------------|----------------|
| C01 | AES-128-ECB, MD5, keyLength=8 | ≤ 0 (score mínimo) |
| C02 | AES-256-CBC, PBKDF2 iterations=1000 | ≤ 20 |
| C03 | Sin cifrado especificado, kdf desconocido | ≥ 60 (campos no auditados) |

## Script de evaluación

```typescript
// tests/benchmarks/auditorAccuracy.ts
import { auditConfig } from '../../src/ai/services/configAuditor';

const testCases = [
  { config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', ... }, expectedFindings: 0, expectedRisk: 'low' },
  { config: { algorithm: 'AES-128-CBC' }, expectedFindings: 1, expectedIds: ['ALG-001'] },
  // ...
];

let tp = 0, fp = 0, fn = 0;
for (const tc of testCases) {
  const result = await auditConfig(tc.config);
  const foundIds = result.findings.map(f => f.id);
  
  for (const id of tc.expectedIds ?? []) {
    if (foundIds.includes(id)) tp++;
    else fn++;
  }
  for (const id of foundIds) {
    if (!tc.expectedIds?.includes(id)) fp++;
  }
}

console.log(`TP=${tp}, FP=${fp}, FN=${fn}`);
console.log(`Precision=${(tp/(tp+fp)*100).toFixed(1)}%`);
console.log(`Recall=${(tp/(tp+fn)*100).toFixed(1)}%`);
```

## Plantilla de resultados

| Métrica | Valor |
|---------|-------|
| Verdaderos positivos (TP) | |
| Falsos positivos (FP) | |
| Falsos negativos (FN) | |
| Precisión | % |
| Recall | % |
| F1-Score | |

## Criterio de éxito

- Precision ≥ 95% (alarmas casi siempre correctas)
- Recall ≥ 90% (detecta casi todas las vulnerabilidades del dataset)
- Score correlación con severidad manual ≥ 0.90 (Pearson)
