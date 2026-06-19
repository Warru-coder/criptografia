# Fase 4.C — Cookie HttpOnly + CSRF dual-mode

> **Estado:** 🟢 COMPLETADA
> **Tag:** `phase-4-cookie-csrf-complete`
> **ADR:** [0016](../docs/decisions/0016-cookie-session-plan.md)
> **Hallazgo:** ALTA-05

## Resumen

Migración del modelo Bearer-only a cookie HttpOnly + CSRF double-submit, manteniendo Bearer como fallback legacy para clientes programáticos durante el modo dual.

## Componentes

| Archivo | Cambio |
|---------|--------|
| `src/web/session/cookieSession.ts` (nuevo) | Helpers `setSessionCookies`, `clearSessionCookies`, `generateCsrfToken`, lectores cookie. Detecta `NODE_ENV=production` para `__Host-` + `Secure`; nombre plano en dev/test. |
| `src/web/middleware/requireCsrf.ts` (nuevo) | Middleware double-submit. No-op para métodos seguros (GET/HEAD/OPTIONS) y para callers Bearer. Comparación constant-time. |
| `src/web/middleware/requireSession.ts` | Dual-mode: cookie primero, Bearer fallback. |
| `src/web/routes/authRoutes.ts` | Login/register/change-password/logout setean o limpian cookies. CSRF inline en change-password. Helper `issueSessionResponse`. |
| `src/web/routes/webauthnRoutes.ts` | Authentication-verify emite cookie + CSRF. `extractToken` lee cookie primero. |
| `src/web/server.ts` | `requireCsrf` montado en `/api/` y `/api/ai/`. |
| `public/js/app.js` | `authHeaders` añade `X-CSRF-Token`; `apiFetch` usa `credentials: 'same-origin'`; estado nuevo `csrfToken` capturado en login. |
| `tests/integration/cookieAuth.test.ts` (nuevo) | 7 tests (cookies HttpOnly, change-password OK con CSRF, sin CSRF 403, CSRF incorrecto 403, Bearer compat, logout clear, GET sin CSRF). |

## Verificación

- `npx vitest run tests/integration tests/unit tests/regression` → **92/92 verde**.
- Backward compat Bearer probado explícitamente: clientes Bearer-only siguen funcionando sin CSRF (test 5).
- Sin regresiones en los 85 tests previos.

## Por qué Bearer permanece (no se elimina aún)

Eliminar Bearer requiere refactor de **todos** los tests de integración (3 ficheros) y de cualquier consumidor externo del API. ADR-0016 plantea: 1 release con dual-mode → deprecation aviso → 1 release más → remove. Esta fase entrega la pieza 1.
