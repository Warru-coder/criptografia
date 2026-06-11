# Guión de Defensa Oral — SecureCrypt TFM

**Duración estimada**: 20 minutos presentación + 10 minutos preguntas  
**Versión**: v0.3.0 — Fase 2 completa

---

## 1. Problema

- **A02 OWASP Top 10 2021** — "Cryptographic Failures" en el puesto 2: los errores más frecuentes no son de teoría sino de implementación (salt fijo, IV reutilizado, KDF débil, contraseña en cada request).
- El código del propio proyecto contenía 8 vulnerabilidades reales documentadas con CVSS (path traversal 8,1 · salt fijo C++ 8,8 · password en body 7,3 · timing attack 5,9) — demuestra que incluso con conocimiento teórico el código defectuoso es la norma, no la excepción.

---

## 2. Solución — qué es SecureCrypt

- **Herramienta de cifrado web multiplataforma** que implementa AES-256-GCM + Argon2id correctamente, con formato de archivo `.scrypt` auto-documentado (cabecera con salt, IV y parámetros KDF embebidos).
- **Sistema multi-usuario con autenticación moderna**: registro/login con contraseña + passkeys FIDO2/WebAuthn, sesiones híbridas (token en SQLite, clave maestra solo en RAM), config centralizada en un único `.env` para cambiar de local a producción.
- **Asistente IA 100 % local**: RAG sobre 15 chunks NIST/OWASP + Ollama (sin datos enviados a cloud) + auditor de configuración determinista con 9 reglas — guía al desarrollador a configurar criptografía correcta sin salir de la herramienta.

---

## 3. Stack técnico

| Componente | Tecnología | Justificación |
|------------|-----------|---------------|
| Runtime / API | Node.js 20 LTS + Express + TypeScript | AES-NI nativo, tipado estático, ecosistema web maduro |
| Cifrado | `node:crypto` (built-in) | AES-256-GCM hardware-accelerated, sin dependencias externas |
| KDF | `argon2` npm 0.40.x | Binding nativo Argon2id, ganador PHC 2015, memory-hard |
| Base de datos | `better-sqlite3` 12.x | Síncrona, WAL mode, sin servidor, despliegue con Docker |
| Autenticación FIDO2 | `@simplewebauthn/server` 13.x | Passkeys W3C WebAuthn Level 2, anti-phishing por diseño |
| Configuración | `dotenv` | Un único `.env` separa desarrollo de producción |
| Seguridad HTTP | `helmet` + `cors` + `express-rate-limit` | Headers, CORS controlado, rate limit diferenciado auth/API |
| IA local | Ollama + TF-IDF RAG custom | LLM local, latencia < 50 ms sin red |
| Contenedores | Docker multi-stage + nginx | Imagen reproducible, reverse proxy con SSL |

---

## 4. Arquitectura

Arquitectura hexagonal en tres capas: el **dominio** (`src/crypto/`, `src/passwordManager/`) es puro TypeScript sin dependencias de framework — `encryptFile` y `decryptFile` no saben que existe Express. La capa de **aplicación** (`src/web/`, `src/cli/`) orquesta el dominio a través de sus puertos. La **infraestructura** (Express, SQLite, Ollama HTTP) es intercambiable sin tocar la lógica de cifrado.

El SessionStore es híbrido: los tokens de sesión persisten en SQLite `(token, userId, expiresAt)` para sobrevivir reinicios, pero la clave maestra **nunca sale de RAM** — un `Map<token, { masterKey: Buffer }>` que se limpia con `fill(0)` al expirar o hacer logout.

Para despliegue: Browser → nginx (SSL) → Express :3000 → Domain; cambiar cinco variables en `.env` (`SERVER_SECRET`, `RP_ID`, `RP_ORIGIN`, `TRUST_PROXY`, `NODE_ENV`) es todo lo necesario para pasar de desarrollo local a VPS/cloud.

---

## 5. IA integrada — 3 funciones

- **Auditor de configuración** (`configAuditor`): evalúa una `CryptoConfig` JSON contra 9 reglas deterministas NIST/OWASP (ALG-001, KDF-001/002/003/004, KEY-001, IV-001, TAG-001, SALT-001), devuelve hallazgos con severidad, CVSS estimado y remediación. Sin LLM — reproducible y testeable. Precisión/Recall = 100 % sobre el dataset de evaluación.
- **Asistente RAG** (`cryptoAssistant`): recupera los 3 chunks más relevantes de la base de conocimiento (15 chunks NIST/OWASP, scoring TF-IDF) y construye el contexto para Ollama. Si Ollama no está disponible, devuelve una respuesta determinista basada en los chunks — la herramienta funciona offline.
- **Proveedor Ollama** (`ollamaProvider`): abstracción sobre `qwen2.5-coder:7b` en localhost; el `SYSTEM_PROMPT` lo orienta exclusivamente a criptografía aplicada, evitando respuestas fuera del dominio.

---

## 6. Seguridad — decisiones criptográficas clave

- **Argon2id como único KDF**: memoryCost=65.536 KB, timeCost=3, parallelism=2 — reduce la velocidad de ataque GPU de ~10.000 hash/s (PBKDF2) a ~2–5 hash/s, una diferencia de 2.000–5.000×. El auditor detecta y rechaza PBKDF2 con menos de 600.000 iteraciones (KDF-001) y Argon2id con memoria < 19.456 KB (KDF-002).
- **GCM Auth Tag verificado antes de devolver datos**: `decipher.setAuthTag()` antes del streaming + `decipher.final()` en try/catch con borrado del archivo parcial — previene ataques de modificación del texto cifrado y padding oracle.
- **Clave maestra nunca en disco ni en logs**: derivada en RAM con Argon2id, limpiada con `fill(0)` al expirar la sesión. Para WebAuthn, la clave se envuelve con `AES-256-GCM(masterKey, SERVER_SECRET)` antes de persistir — sin `SERVER_SECRET` el blob es inútil.

---

## 7. Demo

- Vídeo (3 min): arrancar `npm run dev:web` → registrar usuario → login con contraseña → cifrar un archivo desde la interfaz → auditar `{"algorithm":"AES-128-CBC","kdf":"pbkdf2","iterations":10000}` y ver hallazgos ALG-001 + KDF-001 + KDF-004 con score=20 → hacer una pregunta al asistente IA sobre parámetros Argon2id recomendados → registrar passkey FIDO2 → cerrar sesión → login con passkey.

---

## 8. Resultados experimentos

| Experimento | Métrica | Resultado medido |
|-------------|---------|-----------------|
| EXP-001 — Argon2id benchmark | Tiempo derivación config default (65.536 KB, t=3, p=2) en i7-12700H | **86,5 ms** (σ=7,6 ms) — dentro del rango interactivo OWASP < 100 ms |
| EXP-003 — Auditor precisión | Precisión / Recall / F1 sobre 10 configs (2 seguras + 8 vulnerables) | **100 % / 100 % / 1,000** — TP=9, FP=0, FN=0 |
| Tests suite | Tests automatizados (unit + integración + stress) | **69/69 passed** — 10 suites, 0 fallos |

---

## 9. Trabajo futuro

- **App Windows nativa (C++)**: estructura ya implementada (Win32, BCrypt, SQLite); pendiente completar los diálogos reales (AuthDialog, PasswordDialog) y conectar el repositorio SQLite al motor de cifrado.
- **App Android (Kotlin/Jetpack Compose)**: pendiente de implementación; el formato `.scrypt` y el esquema de cabecera están especificados para facilitar la interoperabilidad.
- **Interoperabilidad de formato entre plataformas**: unificar el KDF en las tres plataformas (web usa Argon2id correcto; C++ usa PBKDF2-HMAC-SHA256 × 600.000 por limitación de BCrypt) — planificado con libsodium para tener Argon2id nativo en C++ y Android.

---

## 10. Conclusión

- La criptografía correcta es un problema de **implementación**, no de teoría: el mismo proyecto contenía 8 vulnerabilidades reales que pasaron desapercibidas hasta el análisis sistemático (CVSS + PoC + corrección + test automatizado) — esa metodología es la contribución reproducible del TFM.
- RAG local con Ollama demuestra que es posible tener IA útil y especializada sin enviar datos a servicios externos: el auditor obtiene precisión perfecta sobre su dominio y el asistente responde preguntas NIST/OWASP con latencia < 50 ms incluso sin conexión.
