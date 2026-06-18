# 0.7 — Threat model STRIDE

## Por qué

No se puede priorizar mitigaciones sin un **mapa de quién amenaza qué**. El threat model formal (`docs/THREAT_MODEL.md`) sirve como:

- Vara de medir: ¿esta vulnerabilidad afecta a un actor real de mi modelo?
- Documento defensivo en la memoria TFM ante un tribunal.
- Base para revisar cada PR ("¿esto introduce un nuevo trust boundary?").

## Metodología

**STRIDE** por cada componente:

| Letra | Amenaza | Propiedad afectada |
|-------|---------|---------------------|
| **S** | Spoofing | Autenticación |
| **T** | Tampering | Integridad |
| **R** | Repudiation | Trazabilidad |
| **I** | Information disclosure | Confidencialidad |
| **D** | Denial of service | Disponibilidad |
| **E** | Elevation of privilege | Autorización |

## Componentes identificados

```
┌──────────────┐    HTTPS    ┌─────────────────────┐
│   Browser    │ ◄─────────► │  Express server     │
│  (app.js)    │             │  - authRoutes       │
└──────────────┘             │  - apiRoutes        │
                             │  - webauthnRoutes   │
┌──────────────┐    stdin    │  - aiRoutes         │
│   CLI        │ ◄─────────► │                     │
└──────────────┘             └──────┬──────────────┘
                                    │
                       ┌────────────┼─────────────┬──────────────┐
                       ▼            ▼             ▼              ▼
                  ┌────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
                  │ SQLite │   │ master  │   │ Ollama  │   │ ~/.sc/  │
                  │  DB    │   │ .hash   │   │ (local) │   │ vault/  │
                  └────────┘   └─────────┘   └─────────┘   └─────────┘

┌──────────────┐
│  Windows EXE │  ← BCrypt CNG, DPAPI, sin red
└──────────────┘
```

## Actores

| Actor | Ubicación | Capacidad |
|-------|-----------|-----------|
| **A1** Atacante remoto sin credenciales | Internet | HTTP requests, fuzzing, DDoS |
| **A2** Usuario malicioso autenticado | Sesión válida | Cualquier acción API permitida |
| **A3** Atacante con XSS exitoso | DOM del navegador víctima | Robo de sessionToken, payloads |
| **A4** Atacante con acceso al disco | Host comprometido | Lectura de DB, master.hash, logs |
| **A5** Atacante MITM en LAN | Red local | Sniff/replay si no hay TLS |
| **A6** Proceso local mismo usuario | Windows | Lectura de proceso, swap, DPAPI |
| **A7** Insider con acceso al servidor | Operario | Lee SERVER_SECRET → unwrap masterKeys |

## Resumen STRIDE por componente

Ver `docs/THREAT_MODEL.md` para la matriz completa por componente × actor × STRIDE. Aquí solo el highlight ejecutivo:

| Riesgo dominante | Afecta a | Mitigación principal | Fase |
|------------------|----------|----------------------|------|
| Compromiso de SERVER_SECRET → unwrap masterKeys de todos (I + E) | A7 | WebAuthn PRF (ADR-008) | 3 |
| XSS → robo de Bearer token (S + I) | A3 | CSP estricto + cookie HttpOnly | 1, 3 |
| KDF roto en C++ → crack offline (I) | A4 | Argon2id real (ADR-003) | 1 |
| Bruteforce vía rate-limit por IP única (S) | A1 | Limit por IP+username (ALTA-07) | 2 |
| Path traversal vía symlink (I + T) | A2 | `realpath` + sandbox (MED-01) | 2 |
| GCM nonce reuse en C++ streaming (I + T) | A4 | secretstream libsodium (ADR-004) | 1 |

## Trust boundaries

1. **Browser ↔ Server** — TLS obligatorio en producción.
2. **Server ↔ Disk** — la masterKey **no debe** ser recuperable solo desde disco. Hoy lo es (CRIT-03 + ALTA-06).
3. **Server ↔ Ollama** — Ollama es untrusted: no enviar contraseñas ni claves.
4. **CLI ↔ Disk** — sandbox por usuario Windows; sin red.
5. **Windows EXE ↔ Disk** — DPAPI por usuario.

## Out of scope

- Compromiso del kernel del host.
- Ataques físicos (cold boot, evil maid).
- Ataques side-channel hardware (Spectre, Meltdown).
- Supply chain de Node.js o libsodium upstream.
