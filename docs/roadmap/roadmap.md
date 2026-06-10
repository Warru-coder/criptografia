# Roadmap — SecureCrypt

> Cuatro fases: TFM → Portfolio → Comercial → SaaS Escalable

---

## Fase 0: Deuda Técnica Crítica (2 semanas)
*Prerequisito obligatorio para todo lo demás*

### Semana 1 — Seguridad crítica
| Tarea | Complejidad | Impacto |
|---|---|---|
| SEC-001: Sandbox de rutas en API | M | Crítico |
| SEC-005: Corregir HashPassword C++ | S | Crítico |
| SEC-010: Try/finally en multer | S | Alto |
| Limpiar repo (prueba/, tmp/) y actualizar .gitignore | S | Medio |
| Resolver merge conflict README.md | XS | Bajo |

### Semana 2 — Correcciones de calidad
| Tarea | Complejidad | Impacto |
|---|---|---|
| SEC-004: Sistema de sesión básico en Express | M | Alto |
| MED-001: Fusionar cryptoUtils.ts + engine.ts | S | Medio |
| MED-002: Sincronizar versión CLI con package.json | XS | Bajo |
| MED-003: Corregir require() en módulo ES | XS | Bajo |
| SEC-003: Comparación tiempo constante C++ | S | Alto |

---

## Fase 1: MVP Académico — Versión TFM (6-8 semanas)

### Objetivo
Demostrar un producto funcional, seguro y con integración de IA real, suficiente para una nota de sobresaliente.

### Sprint 1-2 (Semanas 3-4): KDF Unificado
| Tarea | Complejidad | Descripción |
|---|---|---|
| Investigar libsodium en Windows C++ | M | Compilar con CMake, integrar Argon2id |
| Reemplazar KDF custom C++ por libsodium | L | CryptoEngine::DeriveKey refactor |
| Implementar formato .scrypt v2 con interoperabilidad | L | Header extendido + flag de plataforma |
| Tests de compatibilidad cross-platform | M | Cifrar en Node.js, descifrar en C++ |
| Actualizar documentación de seguridad | S | Reflejar cambios en SECURITY.md |

**Riesgo**: La compilación de libsodium en Windows con MSVC puede tener incompatibilidades. Alternativa: usar BCryptDeriveKeyPBKDF2 de CNG con 600.000 iteraciones como solución intermedia.

### Sprint 3-4 (Semanas 5-6): Integración de IA
| Tarea | Complejidad | Descripción |
|---|---|---|
| AI-FEAT-001: Auditor de configuración | M | Prompt estructurado + salida JSON validada |
| Vectorizar documentación técnica (OWASP, NIST) | M | PDF/MD → chunks → embeddings |
| AI-FEAT-002: Chat RAG básico | L | hnswlib + nomic-embed-text + Qwen2.5 |
| UI para módulo IA en web app | M | Panel de auditoría + chat |
| Métricas de evaluación RAG | M | Dataset 30 Q&A + RAGAS |

### Sprint 5-6 (Semanas 7-8): Pulido y Documentación TFM
| Tarea | Complejidad | Descripción |
|---|---|---|
| Añadir npm audit al CI | XS | Una línea en ci.yml |
| Expandir tests al 80% de cobertura | L | Especialmente vault y AI modules |
| Capturas y diagramas para memoria TFM | M | Draw.io / Excalidraw |
| Memoria TFM completa | XL | ~60-80 páginas |
| Presentación slides | M | 20-25 slides |

**Entregables Fase 1**:
- Aplicación funcional con IA integrada
- Tests con ≥80% cobertura
- KDF unificado Argon2id en las tres plataformas
- Memoria TFM completa
- Demo video (5-10 minutos)

---

## Fase 2: Versión Portfolio (3-4 meses post-TFM)

### Objetivo
Un producto que impresione en entrevistas de trabajo y GitHub.

### Mejoras de producto
| Feature | Complejidad | Valor Portfolio |
|---|---|---|
| UI moderna (React/Tauri para desktop) | XL | Alto |
| AI-FEAT-003: Detector en tiempo real | M | Alto |
| AI-FEAT-004: Clasificador de sensibilidad | M | Alto |
| Soporte para Google Drive / OneDrive (cifrado en la nube) | L | Muy Alto |
| Plugin VSCode para cifrar archivos del workspace | L | Muy Alto |
| README.md con GIFs de demo y badges | M | Medio |
| Website de documentación (Docusaurus) | M | Medio |

### Mejoras técnicas
| Tarea | Complejidad | Descripción |
|---|---|---|
| Migrar a Clean Architecture completa | XL | Refactor mayor |
| Añadir Result<T,E> monad | M | Control de flujo explícito |
| E2E tests con Playwright (web) | M | Cobertura completa |
| Performance benchmarks publicados | M | Comparativa vs competidores |
| SAST con SonarCloud (gratis para open source) | S | Calidad automatizada |

---

## Fase 3: Versión Comercial v1.0 (6-12 meses)

### Modelo de negocio: B2B Freemium
| Tier | Precio | Features |
|---|---|---|
| Free | 0 | Cifrado básico, 5GB, 1 usuario |
| Professional | 9€/mes | IA features, ilimitado, 5 usuarios |
| Business | 29€/mes/usuario | API, SSO, auditoría, SLA |
| Enterprise | Negociado | On-premise, custom KMS, soporte 24h |

### Features para v1.0 Comercial
| Feature | Complejidad | Segmento |
|---|---|---|
| Multi-usuario con permisos granulares | XL | Business |
| Integración con Active Directory / LDAP | XL | Enterprise |
| API REST documentada (Swagger) | L | Developers |
| Key Management Service (KMS) propio | XL | Enterprise |
| Audit log exportable (CSV/JSON/SIEM) | M | Business |
| Cifrado de email (S/MIME, PGP) | L | Professional |
| Dashboard de cumplimiento GDPR | L | Business |

### Infraestructura para tier SaaS
| Componente | Tecnología | Costo estimado/mes |
|---|---|---|
| API backend | Node.js/Bun + Hono | Render/Railway: ~20€ |
| Base de datos | PostgreSQL (Supabase) | ~25€ |
| Almacenamiento | MinIO / Cloudflare R2 | ~10€ + uso |
| IA local | Ollama en GPU VPS | ~50-100€ |
| IA cloud | Claude API | Pay per use |
| CDN | Cloudflare | 0€ (free tier) |
| Total inicial | | ~100-150€/mes |

---

## Fase 4: SaaS Escalable (12-24 meses)

### Arquitectura objetivo
```
┌─────────────────────────────────────────────────────┐
│                  Client Tier                         │
│   Web App │ Desktop (Tauri) │ Mobile │ VSCode Plugin  │
└───────────────────────┬─────────────────────────────┘
                        │ HTTPS + mTLS
┌───────────────────────▼─────────────────────────────┐
│                  API Gateway                         │
│   Rate limiting │ Auth (JWT/OAuth) │ WAF             │
└───────────────────────┬─────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   ┌──────────┐  ┌──────────┐  ┌──────────┐
   │  Vault   │  │   AI     │  │  Audit   │
   │  Service │  │  Service │  │  Service │
   └──────────┘  └──────────┘  └──────────┘
         │              │              │
   ┌─────▼──────────────▼──────────────▼─────┐
   │            Event Bus (Redis/Kafka)        │
   └──────────────────────────────────────────┘
         │
   ┌─────▼──────────────────────────────┐
   │          Data Tier                  │
   │  PostgreSQL │ Redis │ MinIO │ pgvector│
   └────────────────────────────────────┘
```

### KPIs Objetivo Fase 4
- 1.000 usuarios activos mensuales (año 1)
- 100 clientes de pago (año 1)
- MRR: 3.000€ (año 1)
- 10.000 MAU (año 2)
- Cobertura GDPR/ENS documentada

---

## Estimaciones de Complejidad

| Talla | Descripción | Tiempo estimado |
|---|---|---|
| XS | Cambio de 1-5 líneas | 30 min - 1h |
| S | Feature pequeña o corrección | 1-4h |
| M | Feature media con tests | 4-16h |
| L | Feature compleja con refactor | 16-40h |
| XL | Módulo nuevo completo | 40-160h |

---

## Dependencias Críticas del Roadmap

```
SEC-001 (path traversal) ──┐
SEC-005 (HashPassword C++) ─┤
SEC-010 (tmp cleanup) ──────┤→ Fase 0 completa → Fase 1 inicia
SEC-004 (sesión Express) ───┘

Fase 0 completa ──┐
                  ├→ Sprint 1-2 (KDF unificado)
                  │         │
                  │         ├→ Sprint 3-4 (IA) → Sprint 5-6 (TFM) → DEFENSA
                  │
                  └→ [Paralelo] Arquitectura Clean → Fase 2
```
