# Capítulo 8: Evaluación Experimental

## 8.1 Entorno de pruebas

| Componente | Especificación |
|-----------|---------------|
| CPU | _[Completar: modelo, núcleos, frecuencia]_ |
| RAM | _[Completar: GB, tipo, velocidad]_ |
| SO | Windows 11 Home / Ubuntu 22.04 (para Node.js) |
| Node.js | v18 LTS |
| npm argon2 | _[Completar: versión]_ |
| Ollama | _[Completar: versión]_ |
| Modelo LLM | qwen2.5-coder:7b-instruct-q4_K_M |

## 8.2 EXP-001: Benchmark Argon2id

**Protocolo**: `tfm/experimentos/EXP-001_argon2id_benchmark.md`

**Objetivo**: Medir el tiempo de derivación de claves con diferentes parámetros para encontrar el balance entre seguridad y usabilidad.

### Resultados

| memoryCost (KB) | timeCost | parallelism | Tiempo promedio (ms) | Desv. típica |
|----------------|---------|------------|---------------------|--------------|
| 19.456 | 2 | 1 | _[exp]_ | _[exp]_ |
| 19.456 | 3 | 2 | _[exp]_ | _[exp]_ |
| 65.536 | 2 | 1 | _[exp]_ | _[exp]_ |
| **65.536** | **3** | **2** | **_[exp]_** | **_[exp]_** |
| 131.072 | 3 | 2 | _[exp]_ | _[exp]_ |

_[Completar con datos del EXP-001]_

**Conclusión**: Los parámetros SecureCrypt (memoryCost=65536, timeCost=3, parallelism=2) proporcionan [X]ms de tiempo de derivación, dentro del rango OWASP recomendado (500ms-2s para autenticación interactiva).

## 8.3 EXP-002: Throughput AES-256-GCM

**Protocolo**: `tfm/experimentos/EXP-002_aes_throughput.md`

**Objetivo**: Medir el throughput de cifrado/descifrado para diferentes tamaños de archivo.

### Resultados

| Tamaño archivo | Tiempo cifrado (ms) | Throughput (MB/s) | Tiempo descifrado (ms) |
|---------------|--------------------|--------------------|----------------------|
| 1 MB | _[exp]_ | _[exp]_ | _[exp]_ |
| 10 MB | _[exp]_ | _[exp]_ | _[exp]_ |
| 100 MB | _[exp]_ | _[exp]_ | _[exp]_ |
| 1 GB | _[exp]_ | _[exp]_ | _[exp]_ |

_[Completar con datos del EXP-002]_

**Nota**: El tiempo total incluye derivación de claves Argon2id (~[X]ms) + cifrado AES-GCM ([Y]ms). Para archivos pequeños, Argon2id domina el tiempo total.

## 8.4 EXP-003: Precisión del auditor de configuración

**Protocolo**: `tfm/experimentos/EXP-003_ai_audit_accuracy.md`

**Objetivo**: Evaluar la precisión del auditor de configuración en detectar configuraciones inseguras conocidas.

### Dataset de prueba

Se diseñaron 30 configuraciones JSON de prueba:
- 10 configuraciones completamente seguras (OWASP compliant)
- 10 configuraciones con 1-2 vulnerabilidades conocidas
- 10 configuraciones con múltiples vulnerabilidades críticas

### Resultados

| Métrica | Valor |
|---------|-------|
| Verdaderos positivos (vulnerabilidades detectadas) | _[exp]_ / _[exp]_ |
| Falsos negativos (vulnerabilidades no detectadas) | _[exp]_ |
| Falsos positivos (alarmas incorrectas) | _[exp]_ |
| Precisión general | _[exp]_% |
| Puntuación correlación con severidad manual | _[exp]_ |

_[Completar con datos del EXP-003]_

## 8.5 EXP-004: Calidad del RAG

**Protocolo**: `tfm/experimentos/EXP-004_rag_retrieval_quality.md`

**Objetivo**: Evaluar la relevancia de los documentos recuperados y la calidad de las respuestas generadas.

### Métricas evaluadas

**Context Precision**: ¿Los chunks recuperados son relevantes para la pregunta?

| Categoría de pregunta | Precision@3 | Recall@3 |
|----------------------|------------|---------|
| AES y modos de cifrado | _[exp]_ | _[exp]_ |
| KDF (Argon2id, PBKDF2) | _[exp]_ | _[exp]_ |
| IV y salt | _[exp]_ | _[exp]_ |
| Vulnerabilidades | _[exp]_ | _[exp]_ |
| Cumplimiento normativo | _[exp]_ | _[exp]_ |

_[Completar con datos del EXP-004]_

**Faithfulness**: % de afirmaciones en la respuesta verificables en los documentos recuperados.

_[Completar con evaluación manual de 50 respuestas]_

## 8.6 EXP-005: Test de penetración básico

**Protocolo**: `tfm/experimentos/EXP-005_security_penetration.md`

**Objetivo**: Verificar que las correcciones de Fase 0 son efectivas contra los vectores de ataque identificados.

### Resultados

| Vector de ataque | Estado antes Fase 0 | Estado después |
|-----------------|--------------------|--------------| 
| Path traversal (SEC-001) | VULNERABLE | BLOQUEADO |
| Password in body (SEC-002) | VULNERABLE | CORREGIDO |
| Sin autenticación (SEC-004) | VULNERABLE | CORREGIDO |
| Archivos tmp persistentes (SEC-006) | VULNERABLE | CORREGIDO |
| Sin rate limit | VULNERABLE | MITIGADO |
| Sin headers seguridad | VULNERABLE | MITIGADO |

## 8.7 Análisis de cobertura de tests

```
----------------------|---------|----------|---------|---------|
File                  | % Stmts | % Branch | % Funcs | % Lines |
----------------------|---------|----------|---------|---------|
crypto/               |         |          |         |         |
  fileCipher.ts       | _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
  fileDecipher.ts     | _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
passwordManager/      |         |          |         |         |
  passwordValidator.ts| _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
  secureStorage.ts    | _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
ai/services/          |         |          |         |         |
  configAuditor.ts    | _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
  cryptoAssistant.ts  | _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
----------------------|---------|----------|---------|---------|
All files             | _[exp]_ | _[exp]_  | _[exp]_ | _[exp]_ |
```

_[Completar con `npx jest --coverage`]_
