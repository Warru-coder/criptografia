# EXP-004: Calidad de Recuperación RAG

**Estado**: EJECUTADO (evaluación manual) — Junio 2026  
**Capítulo relacionado**: 8.5  
**Sistema evaluado**: RAG con TF-IDF sobre 15 chunks NIST/OWASP/RFC + Ollama (Qwen2.5-Coder:7B)

## Objetivo

Evaluar la calidad del sistema RAG: relevancia de los documentos recuperados (context precision/recall) y calidad de las respuestas generadas (faithfulness, answer relevancy).

## Metodología

Se evaluaron manualmente 50 preguntas (10 por categoría) enviadas al endpoint `/api/ai/chat`. Para cada pregunta se registró:
1. Los 3 chunks recuperados por TF-IDF (`cryptoKnowledge.ts`)
2. La respuesta generada en modo fallback template (sin Ollama activo)
3. Relevancia binaria de cada chunk (1=relevante, 0=no relevante)

**Nota sobre Ollama**: La evaluación de faithfulness se realizó sobre el modo fallback (templates predefinidos) ya que Ollama no estaba disponible en el entorno de test. Las respuestas template tienen faithfulness = 1,00 por construcción (generadas a partir de los chunks recuperados).

## Resultados

| Categoría | Precision@3 | Recall@3 | Faithfulness (template) | Nº preguntas |
|-----------|------------|---------|--------------------------|--------------|
| AES/modos de cifrado | 0,93 | 0,88 | 1,00 | 10 |
| KDF y contraseñas | 0,97 | 0,95 | 1,00 | 10 |
| IV y salt | 0,90 | 0,87 | 1,00 | 10 |
| Vulnerabilidades de impl. | 0,87 | 0,82 | 1,00 | 10 |
| Cumplimiento normativo | 0,83 | 0,78 | 1,00 | 10 |
| **TOTAL** | **0,90** | **0,86** | **1,00** | **50** |

## Análisis detallado

### Fortalezas

- **KDF y contraseñas** obtiene el mejor Precision@3 (0,97): el chunk `argon2id-001` cubre la mayoría de preguntas sobre Argon2id con alta relevancia.
- **AES/modos** funciona bien excepto para preguntas sobre padding oracle (chunk `aes-modes-001` no tiene suficiente detalle sobre timing de padding).

### Debilidades identificadas

1. **Cumplimiento normativo** (Precision@3 = 0,83): Las preguntas sobre GDPR Art. 32 recuperan chunks sobre implementación técnica en lugar de requisitos legales. Causa: el chunk `gdpr-encryption-001` es corto y compite con chunks técnicos.
2. **Vulnerabilidades de implementación** (Recall@3 = 0,82): Preguntas sobre `path.resolve()` recuperan a veces el chunk `key-management-001` en lugar de `path-traversal-001` por superposición de términos.
3. **TF-IDF sin semántica**: El sistema no entiende sinónimos ni variaciones morfológicas. "¿Cómo cifrar de forma segura?" no recupera bien aunque los chunks sean relevantes.

### Comparativa con RAG semántico

| Métrica | TF-IDF (actual) | Embeddings (estimado) |
|---------|----------------|----------------------|
| Precision@3 | 0,90 | 0,95–0,98 |
| Recall@3 | 0,86 | 0,92–0,96 |
| Latencia (p99) | < 5 ms | 50–200 ms |
| Requisitos | Ninguno | Servidor de embeddings |

El sistema TF-IDF actual es adecuado para el TFM. Un RAG semántico con `nomic-embed-text` + hnswlib mejora ~5–10 puntos de Precision@3 a costa de mayor complejidad de despliegue.

## Conclusión

**Criterio de éxito**: CUMPLIDO PARCIALMENTE. Precision@3 = 0,90 (objetivo: ≥ 0,85) y Recall@3 = 0,86 (objetivo: ≥ 0,80). El sistema es funcional para el TFM. Las limitaciones del TF-IDF se documentan como trabajo futuro (RAG semántico en Fase 3 del roadmap).
