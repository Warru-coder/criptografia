# ADR-0016: Plan de migración Bearer → Cookie HttpOnly + CSRF

- **Estado:** Aceptado (plan); implementación en Fase 4 polish
- **Fecha:** 2026-06-18

## Contexto

Hallazgo ALTA-05: el `sessionToken` se transmite como header `Authorization: Bearer ...` y vive en `localStorage`/memoria JS del navegador. Cualquier XSS exitoso roba el token y suplanta sesión.

Aunque Fase 1 cerró CSP (ADR-0006) — la principal mitigación XSS — el patrón Bearer + JS-managed sigue siendo subóptimo para una app que custodia material criptográfico.

## Decisión

Migrar a cookies HttpOnly + CSRF doble-submit token:

- Cookie de sesión `__Host-sc_session`:
  - `HttpOnly` — JS no puede leerla.
  - `Secure` — solo HTTPS.
  - `SameSite=Strict` — protege contra CSRF cross-site.
  - `Path=/` con prefijo `__Host-` para defensa adicional.
- Cookie CSRF `__Host-sc_csrf` (visible a JS) cuyo valor el cliente añade en cabecera `X-CSRF-Token` en peticiones mutating.
- Server compara `req.cookies.sc_csrf === req.headers['x-csrf-token']` (double-submit).

## Por qué no se ejecuta en Fase 3

- Afecta a **todos** los clientes (browser, tests integration, posibles consumidores externos del API).
- Los tests de integración usan `supertest` con headers Bearer; convertirlos a cookies requiere agente con cookie-jar.
- El frontend `app.js` tiene ~700 líneas con manejo manual del token; refactor no trivial.
- Riesgo de regresión alto vs. el beneficio incremental sobre CSP estricta (que ya bloquea XSS).

## Plan Fase 4

1. Mantener Bearer y cookie simultáneamente durante 1 release (modo dual).
2. `requireSession` lee primero la cookie; si no hay, fallback al header.
3. Endpoint `/api/auth/login` setea cookie + devuelve token en JSON (compat).
4. Endpoint `/api/auth/csrf` para que el JS obtenga el token CSRF.
5. Frontend prefiere cookie; tests se migran progresivamente.
6. Tras 1 release con dual-mode: Bearer pasa a deprecated; otro release y se elimina.

## Verificación (cuando se implemente)

- [ ] Tests integration con cookie jar (supertest agent).
- [ ] Test CSRF: petición sin cabecera X-CSRF-Token → 403.
- [ ] Test SameSite: simulación de origin cruzado → cookie no se envía.

## Referencias

- ALTA-05 en informe.
- OWASP Session Management Cheat Sheet.
- MDN: SameSite cookies.
