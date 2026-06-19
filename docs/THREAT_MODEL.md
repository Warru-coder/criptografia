# SecureCrypt — Threat Model (STRIDE)

> Versión inicial generada en Fase 0 de la auditoría de seguridad (2026-06-18).
> Branch: `security/remediation`. Tag base: `pre-audit-v0.3.0`.

## 1. Activos protegidos

| ID | Activo | Por qué importa |
|----|--------|-----------------|
| AS-1 | Contraseñas maestras de usuarios | Acceso total al vault del usuario |
| AS-2 | masterKey AES-256 derivada | Cifra/descifra TODOS los archivos del usuario |
| AS-3 | Ficheros `.scrypt` del usuario | El producto de la herramienta |
| AS-4 | `SERVER_SECRET` | Wraps todas las masterKeys vía WebAuthn |
| AS-5 | Sesiones activas (tokens) | Acceso temporal a la API autenticada |
| AS-6 | Credenciales WebAuthn (public keys) | Vector de autenticación |
| AS-7 | Logs de operación | Pueden filtrar nombres de fichero del usuario |
| AS-8 | Base de datos SQLite (`securecrypt.db`) | Contiene users, sessions, webauthn, wrappedKey |

## 2. Actores

| ID | Actor | Capacidad |
|----|-------|-----------|
| A1 | Atacante remoto anónimo | HTTP, fuzzing, DDoS, OSINT |
| A2 | Usuario autenticado malicioso | API válida con sus credenciales |
| A3 | Atacante con XSS exitoso | Ejecuta JS en el DOM de la víctima |
| A4 | Atacante con acceso de lectura al disco del servidor | Lee DB, `.env`, logs, `master.hash` |
| A5 | MITM en LAN sin TLS | Sniff, replay, inject |
| A6 | Proceso local mismo usuario (Windows) | Dump de memoria del proceso EXE |
| A7 | Insider del servidor | Lee SERVER_SECRET → unwrap masterKeys |
| A8 | Atacante con acceso de escritura al disco | Inyecta symlinks, modifica binarios |

## 3. Trust boundaries

```
┌──────────────────────────────────────────────────────────────┐
│  ZONA 1: NAVEGADOR DEL USUARIO (no confiable)                │
│  - JS de app.js, sessionToken en memoria JS                  │
└──────────────┬───────────────────────────────────────────────┘
               │ HTTPS (en prod) / HTTP (dev) ← TRUST BOUNDARY
┌──────────────▼───────────────────────────────────────────────┐
│  ZONA 2: SERVIDOR EXPRESS (confianza media)                  │
│  - Mantiene masterKey en memoria mientras hay sesión         │
│  - SERVER_SECRET en memoria (env var)                        │
└──────────────┬───────────────────────────────────────────────┘
               │ syscall fs ← TRUST BOUNDARY
┌──────────────▼───────────────────────────────────────────────┐
│  ZONA 3: DISCO (no confiable para datos en reposo)           │
│  - DB SQLite, master.hash, logs, .env                        │
│  - Plaintext en tmpDir durante un upload/download            │
└───────────────────────────────────────────────────────────────┘

ZONA 4 (independiente): WINDOWS EXE
- Sin red. Confianza: nivel del proceso del usuario en Windows.
- Materia clave en DPAPI + memoria.
```

## 4. Matriz STRIDE × Componente

### 4.1 Express server (web)

| | Amenaza | Actor | Mitigación actual | Hallazgo asociado | Fase |
|---|---------|-------|-------------------|-------------------|------|
| **S** | Robo de Bearer token vía XSS | A3 | CSP (con `unsafe-inline` ❌) | CRIT-05, ALTA-05 | 1, 3 |
| **S** | Bruteforce contraseñas | A1 | Rate limit 10/15min por IP | ALTA-07 | 2 |
| **S** | Enumeración de usuarios | A1 | Constant-time verify | OK | — |
| **T** | Modificación de uploads in-flight | A5 | TLS en prod (Nginx) | OK si HTTPS | — |
| **T** | Path traversal en encrypt-dir | A2 | sandboxPath (sin realpath) | MED-01 | 2 |
| **R** | Borrado de logs | A2/A7 | Sin protección dedicada | MED-06 | 4 |
| **I** | Fuga de `error.message` con paths internos | A1 | Filtro parcial | MED-03 | 4 |
| **I** | SSE `/progress` revela nombres de otros usuarios | A1 | Sin auth | MED-05 | 3 |
| **D** | DoS por payload JSON 50 MB | A1 | Limit Express grande | ALTA-03 | 2 |
| **D** | DoS subiendo a `/verify` (sin auth, 10 GB) | A1 | Sin auth | ALTA-09 | 3 |
| **E** | Privilegio horizontal: acceso a sesión de otro usuario | A2 | Tokens 256 bits aleatorios | OK | — |

### 4.2 Núcleo criptográfico (Node)

| | Amenaza | Actor | Mitigación actual | Hallazgo | Fase |
|---|---------|-------|-------------------|----------|------|
| **T** | Manipulación de ciphertext sin detección | A4 | AES-256-GCM authTag | OK | — |
| **I** | Crack offline de password desde DB | A4 | Argon2id m=64MiB t=3 | OK | — |
| **I** | KDF doble innecesario (confusión KEK/DEK) | conceptual | Ninguna | ALTA-01 | 2 |
| **I** | Dos artefactos hash por contraseña (master.hash + DB) | A4 | Ninguna | ALTA-02 | 2 |

### 4.3 WebAuthn / passkeys

| | Amenaza | Actor | Mitigación actual | Hallazgo | Fase |
|---|---------|-------|-------------------|----------|------|
| **S** | Phishing de credenciales | A1 | WebAuthn (resistente by design) | OK | — |
| **E** | Compromiso del servidor → unwrap de TODAS las masterKeys | A4/A7 | SERVER_SECRET débil + padding 0 | CRIT-03, ALTA-06 | 1, 3 |
| **I** | Compromiso de DB revela wrappedKey con clave conocida | A4 | Igual que arriba | CRIT-03 | 1 |

### 4.4 Sesiones

| | Amenaza | Actor | Mitigación | Hallazgo | Fase |
|---|---------|-------|------------|----------|------|
| **S** | Session fixation | A1 | Token nuevo en cada login | OK | — |
| **S** | Replay tras logout | A1 | DB delete + memory delete | OK | — |
| **I** | Bearer accesible a JS (no HttpOnly) | A3 | Ninguna (es Bearer) | ALTA-05 | 3 |
| **R** | No hay invalidación tras cambio de password | A2 | (Endpoint no existe) | MED-04 | 3 |

### 4.5 App Windows C++

| | Amenaza | Actor | Mitigación | Hallazgo | Fase |
|---|---------|-------|------------|----------|------|
| **I** | KDF roto → crack offline trivial | A4 | DPAPI sobre clave (no sirve si DPAPI compromised) | CRIT-01 | 1 |
| **T** | Streaming GCM mal implementado → ciphertext maleable | A4 | Ninguna real | CRIT-02 | 1 |
| **I** | Nonce reuse → recuperación de plaintext | A4 | Ninguna | CRIT-02 | 1 |

### 4.6 IA / Ollama

| | Amenaza | Actor | Mitigación | Hallazgo | Fase |
|---|---------|-------|------------|----------|------|
| **I** | Prompt injection vía mensajes del usuario | A2 | Solo local, sin tools | Aceptable (Ollama local) | — |
| **I** | Logging de prompts con datos sensibles | A4 | Truncado a 1000 chars | Aceptable | — |

### 4.7 Docker / Nginx

| | Amenaza | Actor | Mitigación | Hallazgo | Fase |
|---|---------|-------|------------|----------|------|
| **T** | Image drift sin pin de digest | A1 (supply chain) | Ninguna | BAJA-03 | 4 |
| **D** | TLS ciphers anticuados | A5 | Ejemplo Nginx `HIGH:!aNULL:!MD5` | BAJA-04 | 4 |

## 5. Prioridades

```
P0 (Fase 1): CRIT-01, CRIT-02, CRIT-03, CRIT-04, CRIT-05
P1 (Fase 2): ALTA-01, ALTA-02, ALTA-07, ALTA-08, MED-01, MED-02
P2 (Fase 3): ALTA-05, ALTA-06, ALTA-09, MED-04, MED-05
P3 (Fase 4): MED-03, MED-06, MED-07, MED-08, BAJA-*
```

## 6. Decisiones explícitas de NO mitigar (con justificación)

| Riesgo | Por qué no se mitiga | Compensación |
|--------|---------------------|--------------|
| Cold boot attack | Fuera del modelo (acceso físico) | Documentado en SECURITY.md |
| Side-channel hardware (Spectre) | Fuera del modelo (kernel/CPU) | Confiamos en parches del SO |
| Compromiso kernel del host | Cualquier app cae con el SO | — |
| Ataque al modelo Ollama local | Ollama es local; output no se ejecuta | — |

## 7. Mantenimiento

Este documento se revisa:

- Al cierre de cada fase de remediación.
- Al introducir un nuevo componente (nuevo trust boundary).
- Al recibir un report de vulnerabilidad externo.
- Cada 6 meses como mínimo en producción.
