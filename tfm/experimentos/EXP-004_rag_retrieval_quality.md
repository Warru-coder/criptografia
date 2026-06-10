# EXP-004: Calidad de Recuperación RAG

**Estado**: Pendiente de ejecución  
**Capítulo relacionado**: 8.5

## Objetivo

Evaluar la calidad del sistema RAG: relevancia de los documentos recuperados (context precision/recall) y calidad de las respuestas generadas (faithfulness, answer relevancy).

## Dataset de preguntas de evaluación (50 preguntas)

### Categoría 1: AES y modos de cifrado (10 preguntas)

| ID | Pregunta | Chunks esperados |
|----|---------|-----------------|
| Q01 | ¿Qué diferencia hay entre AES-CBC y AES-GCM? | aes-modes-001, aes-gcm-001 |
| Q02 | ¿Por qué AES-ECB es inseguro? | aes-modes-001 |
| Q03 | ¿Cuántos bits tiene el authentication tag de GCM? | auth-tag-001, aes-gcm-001 |
| Q04 | ¿Qué significa AEAD? | aes-gcm-001 |
| Q05 | ¿Qué longitud de clave recomienda NIST para AES? | aes-gcm-001 |
| Q06 | ¿Qué pasa si uso AES-128 en lugar de AES-256? | aes-gcm-001 |
| Q07 | ¿Cuál es la diferencia entre cifrado y cifrado autenticado? | aes-gcm-001, auth-tag-001 |
| Q08 | ¿Qué es el padding oracle attack? | aes-modes-001 |
| Q09 | ¿Puedo usar AES-CTR sin autenticación adicional? | aes-modes-001 |
| Q10 | ¿Qué es GCM mode? | aes-gcm-001 |

### Categoría 2: KDF y contraseñas (10 preguntas)

| ID | Pregunta | Chunks esperados |
|----|---------|-----------------|
| Q11 | ¿Cuál es el KDF recomendado por OWASP en 2024? | argon2id-001 |
| Q12 | ¿Cuántas iteraciones necesita PBKDF2-SHA256? | pbkdf2-001 |
| Q13 | ¿Qué parámetros de Argon2id recomienda OWASP? | argon2id-001 |
| Q14 | ¿Por qué bcrypt es peor que Argon2id? | argon2id-001 |
| Q15 | ¿Qué es un KDF memory-hard? | argon2id-001 |
| Q16 | ¿Qué es el parallelism en Argon2id? | argon2id-001 |
| Q17 | ¿Cuál es la diferencia entre Argon2i, Argon2d y Argon2id? | argon2id-001 |
| Q18 | ¿Es seguro usar MD5 para almacenar contraseñas? | pbkdf2-001 |
| Q19 | ¿Qué RFC define Argon2? | argon2id-001 |
| Q20 | ¿Por qué scrypt es peor que Argon2id para contraseñas? | argon2id-001, pbkdf2-001 |

### Categoría 3: IV y salt (10 preguntas)

| ID | Pregunta | Chunks esperados |
|----|---------|-----------------|
| Q21 | ¿Qué longitud de IV recomienda NIST para GCM? | iv-nonce-001 |
| Q22 | ¿Qué pasa si reutilizo el nonce en AES-GCM? | iv-nonce-001 |
| Q23 | ¿Para qué sirve el salt en las contraseñas? | salt-001 |
| Q24 | ¿Cuál es el tamaño mínimo del salt? | salt-001 |
| Q25 | ¿Qué son las rainbow tables? | salt-001 |
| Q26 | ¿El IV debe ser secreto? | iv-nonce-001 |
| Q27 | ¿Cómo genero un IV seguro en Node.js? | iv-nonce-001, secure-random-001 |
| Q28 | ¿Puedo usar un contador como IV en GCM? | iv-nonce-001 |
| Q29 | ¿Qué es el birthday paradox aplicado al IV? | iv-nonce-001 |
| Q30 | ¿Debo usar un salt diferente para cada usuario? | salt-001 |

### Categoría 4: Vulnerabilidades de implementación (10 preguntas)

| ID | Pregunta | Chunks esperados |
|----|---------|-----------------|
| Q31 | ¿Qué es un timing attack en criptografía? | timing-attack-001 |
| Q32 | ¿Cómo prevenir path traversal en Node.js? | path-traversal-001 |
| Q33 | ¿Por qué no comparar hashes con == en JavaScript? | timing-attack-001 |
| Q34 | ¿Qué es crypto.timingSafeEqual? | timing-attack-001 |
| Q35 | ¿Cómo gestionar el ciclo de vida de las claves? | key-management-001 |
| Q36 | ¿Cuándo debo rotar las claves de cifrado? | key-management-001 |
| Q37 | ¿Qué es path.resolve() y por qué usarlo? | path-traversal-001 |
| Q38 | ¿Cómo generar números aleatorios seguros en Node.js? | secure-random-001 |
| Q39 | ¿Qué es Math.random() y por qué no usarlo en criptografía? | secure-random-001 |
| Q40 | ¿Qué significa "limpiar claves de memoria"? | key-management-001 |

### Categoría 5: Cumplimiento normativo (10 preguntas)

| ID | Pregunta | Chunks esperados |
|----|---------|-----------------|
| Q41 | ¿Qué exige GDPR Art. 32 sobre cifrado? | gdpr-encryption-001 |
| Q42 | ¿Qué es OWASP ASVS? | owasp-asvs-001 |
| Q43 | ¿Qué controles criptográficos requiere OWASP ASVS 4.0? | owasp-asvs-001 |
| Q44 | ¿Qué estándar NIST define AES-GCM? | aes-gcm-001 |
| Q45 | ¿Qué RFC define PBKDF2? | pbkdf2-001 |
| Q46 | ¿Qué es el cifrado en reposo vs. en tránsito? | gdpr-encryption-001 |
| Q47 | ¿Qué es el formato .scrypt de SecureCrypt? | format-scrypt-001 |
| Q48 | ¿Qué estándares cubre SecureCrypt? | owasp-asvs-001, gdpr-encryption-001 |
| Q49 | ¿Cómo cifrar archivos grandes de forma eficiente? | streaming-encryption-001 |
| Q50 | ¿Qué es el AAD en AES-GCM? | aes-gcm-001, auth-tag-001 |

## Métricas de evaluación

### Context Precision@3

Para cada pregunta, los 3 chunks recuperados se evalúan manualmente:
- 1 = chunk relevante para la respuesta
- 0 = chunk no relevante

`Precision@3 = (chunks relevantes recuperados) / 3`

### Faithfulness (evaluación manual)

Para las respuestas en modo Ollama, evaluar cada afirmación:
- ¿Está respaldada por uno de los chunks recuperados?

`Faithfulness = (afirmaciones verificables) / (total afirmaciones)`

## Plantilla de resultados

| Categoría | Precision@3 | Recall@3 | Faithfulness (Ollama) |
|-----------|------------|---------|----------------------|
| AES/modos | | | |
| KDF | | | |
| IV/salt | | | |
| Vulnerabilidades | | | |
| Cumplimiento | | | |
| **TOTAL** | | | |
