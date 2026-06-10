# Guión de Defensa Oral — SecureCrypt TFM

**Duración estimada**: 20 minutos presentación + 10 minutos preguntas  
**Formato recomendado**: Diapositivas (Keynote/PowerPoint/Reveal.js)  
**Versión**: v0.3.0 post-Fase 2

---

## BLOQUE 1: Motivación y contexto (3 min)

### Diapositiva 1 — Portada
- Título, autor, director, fecha
- Captura de la interfaz web con el panel de login y AI Advisor

### Diapositiva 2 — El problema
**Punto clave**: La correcta implementación criptográfica sigue siendo un problema no resuelto

Datos de impacto:
- OWASP Top 10 2021 incluye "A02: Cryptographic Failures" en el puesto 2 de vulnerabilidades más comunes
- Los ataques a implementaciones criptográficas defectuosas (padding oracle, IV reutilizado, KDF débil) representan una fracción significativa de brechas de datos reales
- Incluso desarrolladores con conocimientos teóricos cometen errores en la implementación (salt fijo, comparación no-constante, password en body)

**Demostración visual**: Código vulnerable original (salt fijo en C++, password en cada request) vs. código corregido (Argon2id, tokens de sesión, prepared statements)

### Diapositiva 3 — Propuesta de valor
SecureCrypt resuelve tres problemas:
1. Herramienta de cifrado multiplataforma que implementa correctamente AES-256-GCM + Argon2id
2. Sistema multi-usuario con autenticación moderna (contraseña + passkeys FIDO2)
3. Asistente IA local (RAG + Ollama) que guía la configuración sin dependencias cloud

---

## BLOQUE 2: Arquitectura (4 min)

### Diapositiva 4 — Stack tecnológico
Diagrama visual: Browser → Express → Domain (AES-GCM, Argon2id) + Auth (SQLite, WebAuthn) + AI (RAG, Ollama)

**Justificar decisiones clave**:
- Web-first: máxima accesibilidad, cero instalación
- TypeScript estricto: eliminación de errores en tiempo de compilación
- SQLite embebido: sin servidor de base de datos, despliegue reproducible con Docker

### Diapositiva 5 — Formato .scrypt
Diagrama de la cabecera del archivo:
```
[MAGIC 6B][VER 1B][PARAMS][SALT 32B][IV 12B] || [CIPHERTEXT] || [TAG 16B]
```

**Destacar**: El salt y los parámetros Argon2id van en la cabecera → self-documenting, sin configuración externa

### Diapositiva 6 — Arquitectura multi-usuario (Fase 2)
Diagrama: User → Register/Login → SessionStore (mem + SQLite) → Vault aislado por usuario

**Puntos clave**:
- Clave maestra en memoria, token en SQLite: si se roba la DB no hay claves expuestas
- WebAuthn/FIDO2: passkeys ligadas al origen → inmunes a phishing
- Rate limiting separado para auth (10 req/15 min) vs. API general (100 req/15 min)

---

## BLOQUE 3: Implementación criptográfica (4 min)

### Diapositiva 7 — AES-256-GCM con streaming
Diagrama del pipeline:
```
Input → cipher.update(chunks) → Output + authTag al final
```

**Punto crítico**: El authTag DEBE verificarse antes de devolver datos. Mostrar el código de decryptFile con try/catch en decipher.final()

### Diapositiva 8 — Argon2id: parámetros y resultados reales

Tabla con datos del EXP-001 ejecutado en este hardware:

| Parámetro | OWASP mínimo | SecureCrypt default | Tiempo medido |
|-----------|-------------|---------------------|--------------|
| memoryCost | 19.456 KB | 65.536 KB | 72,3 ms |
| timeCost | 2 | 3 | (incluido) |
| parallelism | 1 | 2 | (incluido) |

**Gráfico**: Comparativa GPU hashes/s: PBKDF2 (~10.000/s) vs. Argon2id (~2-5/s) → diferencia de 2.000–5.000×

### Diapositiva 9 — Correcciones de seguridad (resumen)

Tabla con hallazgos, CVSS y estado post-Fase 2:

| ID | CVSS | Descripción breve | Estado |
|----|------|-------------------|--------|
| SEC-001 | 8,1 | Path traversal | MITIGADO |
| SEC-002 | 7,3 | Password en body | MITIGADO |
| SEC-003 | 5,9 | Timing attack C++ | MITIGADO |
| SEC-004 | 8,8 | Salt fijo C++ | MITIGADO |
| SEC-005 | 6,5 | Deadlock mutex C++ | MITIGADO |
| SEC-006 | 5,3 | Archivos tmp | MITIGADO |
| SEC-007/8 | 7,5 | Rate limit + tokens | MITIGADO (Fase 2) |

---

## BLOQUE 4: Sistema IA (4 min)

### Diapositiva 10 — Arquitectura RAG

Diagrama del pipeline:
```
Consulta → TF-IDF sobre 15 chunks NIST/OWASP → Top-3 → Ollama → Respuesta
                                                          ↓ offline
                                                    Template answer
```

**Punto diferenciador**: 100% local, sin datos enviados a cloud, funciona offline, latencia < 50 ms (TF-IDF)

### Diapositiva 11 — Demostración en vivo

1. Abrir interfaz web → Login con contraseña (o passkey si el navegador lo soporta)
2. Config Auditor: pegar `{"algorithm": "AES-128-CBC", "kdf": "pbkdf2", "iterations": 10000}` → ver hallazgos ALG-001 + KDF-001 + KDF-004, score=20
3. Chat: preguntar "¿Qué parámetros Argon2id recomienda OWASP para contraseñas?"

### Diapositiva 12 — Resultados del auditor (EXP-003)

Tabla de resultados reales:
- **Precisión: 100%** (TP=9, FP=0)
- **Recall: 100%** (FN=0)
- **F1-Score: 1,000**
- 9 reglas NIST/OWASP, evaluación determinista

---

## BLOQUE 5: Evaluación y conclusiones (5 min)

### Diapositiva 13 — Resultados experimentales (datos reales)

| Experimento | Métrica principal | Resultado | Criterio |
|-------------|-----------------|-----------|---------|
| EXP-001 Argon2id | Tiempo derivación default | 72,3 ms | ✓ < 500 ms |
| EXP-002 AES-GCM | Throughput cifrado | 319 MB/s | ✓ ≥ 100 MB/s |
| EXP-003 Auditor | Precisión / Recall | 100% / 100% | ✓ ≥ 95% / 90% |
| EXP-004 RAG | Precision@3 total | 0,90 | ✓ ≥ 0,85 |
| EXP-005 Pentest | Vectores bloqueados | 10/10 | ✓ 100% |

### Diapositiva 14 — Objetivos cumplidos vs. pendientes

| Objetivo | Estado |
|----------|--------|
| OBJ-01: AES-256-GCM + Argon2id en Node.js | ✓ CUMPLIDO |
| OBJ-02: Seguridad auditada (CVSS + pentest) | ✓ CUMPLIDO |
| OBJ-03: Sistema IA local (RAG + auditor) | ✓ CUMPLIDO |
| OBJ-04: Multi-usuario + WebAuthn (Fase 2) | ✓ CUMPLIDO |
| OBJ-05: Suite de tests (69 tests, cobertura 63%) | ✓ CUMPLIDO |
| OBJ-06: Windows C++ con Argon2id unificado | ⚠ PARCIAL (KDF propio) |
| OBJ-07: Android Kotlin funcional | ⏳ PENDIENTE |

### Diapositiva 15 — Trabajo futuro

Roadmap actualizado:
- **Fase 3 / Portfolio**: RAG semántico con embeddings, UI React/Tauri, extensión VS Code
- **Fase 4 / Comercial**: API pública, macOS, integración cloud (Drive/OneDrive cifrado)
- **Fase 5 / SaaS**: Post-cuántico (ML-KEM/Kyber), HSM, auditoría SOC 2

### Diapositiva 16 — Conclusiones

**Tres takeaways**:
1. La criptografía correcta requiere **implementación** correcta, no solo teoría (el código vulnerable era de un proyecto real)
2. RAG local con Ollama elimina el trade-off entre IA útil y privacidad de datos
3. El análisis sistemático (CVSS + PoC + corrección + test automatizado) es una metodología reproducible para cualquier proyecto de seguridad

---

## Preguntas frecuentes del tribunal

**P: ¿Por qué no usar bcrypt en lugar de Argon2id?**  
R: Argon2id es memory-hard con control preciso de parámetros y ganó el Password Hashing Competition 2015. bcrypt tiene límite de 72 bytes de contraseña y es menos eficiente en garantías anti-GPU. OWASP 2024 recomienda Argon2id explícitamente. En EXP-001 medimos 72 ms con los parámetros default, demostrando que es viable en UX interactiva.

**P: ¿Por qué TF-IDF y no embeddings vectoriales?**  
R: TF-IDF es suficiente para un dominio tan específico con vocabulario controlado (15 chunks, terminología técnica precisa). Los embeddings añaden complejidad (modelo 80MB adicional, servidor de embeddings), latencia y GPU para ser eficientes. EXP-004 confirma Precision@3 = 0,90 con TF-IDF. El plan incluye embeddings en Fase 3.

**P: ¿Es seguro almacenar la clave maestra en memoria del servidor?**  
R: Es el enfoque estándar. La alternativa (derivar la clave en cada request) requeriría la contraseña en cada request — el problema de SEC-002 que precisamente solucionamos. La clave se limpia de memoria con `fill(0)` al hacer logout o expirar la sesión. El atacante necesita acceso a la memoria del proceso en ejecución, no solo al disco.

**P: ¿Cómo escala esto a múltiples usuarios concurrentes?**  
R: El SessionStore actual es in-memory por proceso. Para escalar horizontalmente se usaría Redis con TTL. La SQLite con WAL mode soporta múltiples lectores concurrentes. Los workers de cifrado tienen su propio pool — el stress test EXP-002 demuestra 319 MB/s con I/O en streaming.

**P: ¿Por qué Node.js y no Go o Rust para las operaciones criptográficas?**  
R: Node.js crypto delega a OpenSSL con aceleración AES-NI cuando está disponible. El throughput medido en EXP-002 (319 MB/s cifrado, 508 MB/s descifrado) es comparable a Go/Rust para archivos de tamaño mediano. La ventaja es la integración nativa con el ecosistema web (Express, TypeScript, npm) y la velocidad de iteración.

**P: ¿Las passkeys WebAuthn son compatibles con todos los navegadores?**  
R: Sí, desde 2023. WebAuthn Level 2 está implementado en Chrome 108+, Safari 16+, Firefox 122+, Edge 108+ y todos los navegadores móviles modernos. SecureCrypt ofrece contraseña como fallback para dispositivos sin soporte biométrico.

**P: ¿Cómo se justifica la inconsistencia KDF entre plataformas?**  
R: Es una limitación documentada (ADR-001). Node.js usa Argon2id correcto. Windows C++ usa SHA-256 iterado (KDF personalizado débil), documentado como trabajo futuro urgente. Android usa PBKDF2 × 30.000 (aceptable pero no óptimo). Los archivos **no son intercambiables** entre plataformas, lo que se documenta explícitamente. La unificación con libsodium está planificada para la Fase 3.
