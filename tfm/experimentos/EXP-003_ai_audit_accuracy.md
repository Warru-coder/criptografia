# EXP-003: Precisión del Auditor de Configuración

**Estado**: EJECUTADO — Junio 2026  
**Capítulo relacionado**: 8.4  
**Herramienta**: `tests/benchmarks/exp003.ts` | **Reglas evaluadas**: 9 (ALG-001, KDF-001/002/003/004, KEY-001, IV-001, TAG-001, SALT-001)

## Objetivo

Evaluar la precisión del auditor de configuración en detectar vulnerabilidades criptográficas conocidas y clasificarlas con la severidad correcta.

## Metodología

Se evaluaron 10 configuraciones (2 seguras + 8 vulnerables) contra el conjunto de 9 reglas del `configAuditor`. La evaluación es **determinista** (sin LLM): las reglas implementan predicados lógicos sobre los parámetros de configuración.

```bash
npx tsx tests/benchmarks/exp003.ts
```

## Resultados por caso

| Caso | Descripción | Findings esperados | Findings obtenidos | Score | Risk |
|------|-------------|-------------------|--------------------|-------|------|
| S01 | AES-256-GCM + Argon2id (default) | ninguno | ninguno | 100 | low |
| S02 | AES-256-GCM + Argon2id (mínimo OWASP) | ninguno | ninguno | 100 | low |
| V01 | AES-128-CBC | ALG-001 | ALG-001 | 60 | high |
| V03 | PBKDF2 10.000 iter | KDF-001, KDF-004 | KDF-001, KDF-004 | 40 | high |
| V05 | Argon2id memoryCost=4.096 KB | KDF-002 | KDF-002 | 80 | medium |
| V06 | Argon2id timeCost=1 | KDF-003 | KDF-003 | 90 | low |
| V07 | keyLength=16 (128 bits) | KEY-001 | KEY-001 | 80 | medium |
| V08 | ivLength=8 bytes | IV-001 | IV-001 | 80 | medium |
| V09 | tagLength=12 bytes | TAG-001 | TAG-001 | 80 | medium |
| V10 | saltLength=8 bytes | SALT-001 | SALT-001 | 90 | low |

## Métricas de evaluación

| Métrica | Valor |
|---------|-------|
| Verdaderos positivos (TP) | 9 |
| Falsos positivos (FP) | 0 |
| Falsos negativos (FN) | 0 |
| **Precisión** | **100%** |
| **Recall** | **100%** |
| **F1-Score** | **1,000** |

## Análisis

El auditor obtiene precisión y recall perfectos en el dataset de evaluación. Esto era esperable dado que:

1. Las reglas son predicados lógicos deterministas sobre campos concretos (sin ambigüedad).
2. El dataset fue diseñado para cubrir exactamente los casos que las reglas auditan.

### Limitaciones reconocidas

- **Cobertura limitada**: 9 reglas cubren los vectores más comunes pero no el espacio completo de vulnerabilidades (p. ej., ECDH mal implementado, claves débiles exportadas, etc.).
- **Sin análisis de código fuente**: El auditor evalúa la configuración declarada, no el código que la implementa. Una configuración correcta puede ejecutarse incorrectamente.
- **Sin IA en este modo**: Los resultados son del auditor basado en reglas. El módulo Ollama (`isOllamaAvailable = false` en entorno de test) añade análisis contextual adicional cuando está disponible.

## Conclusión

**Criterio de éxito**: CUMPLIDO. Precisión ≥ 95% y Recall ≥ 90% (obtenido 100%/100%). El auditor es fiable para el conjunto de vulnerabilidades definidas, con la limitación de que evalúa configuración declarada y no código ejecutado.
