# ADR-0006: CSP estricta sin `'unsafe-inline'`

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase de remediación:** 1

## Contexto

Hallazgo CRIT-05 de la auditoría: el header CSP servido por `helmet` contenía
`'unsafe-inline'` tanto en `scriptSrc` como en `styleSrc`. Esto neutralizaba la
defensa frente a XSS: cualquier inyección de `<script>` o atributo `on*=` se
ejecutaría con permisos completos del origen, permitiendo robo de `sessionToken`
(Bearer guardado en memoria JS) y exfiltración de la masterKey en uso.

Inspección del frontend reveló:
- `public/index.html` no tenía **ningún** `<script>` inline ni handler `on*=`.
- `public/index.html` no tenía bloques `<style>` ni atributos `style="..."`.
- El único uso real de inline style era una línea JS (`renderAuditResults`) que
  inyectaba `style="color:${color};border-color:${color}"` en HTML generado.
- Asignaciones programáticas `element.style.width = ...` **NO requieren**
  `'unsafe-inline'` (CSP no aplica a propiedades DOM, solo al CSS textual del HTML).

## Decisión

1. Eliminar `'unsafe-inline'` de `scriptSrc` y `styleSrc`.
2. Reemplazar el único uso de inline style en `app.js` por clases CSS
   (`.risk-low/.risk-medium/.risk-high/.risk-critical` añadidas a `styles.css`).
3. Endurecer la CSP con directivas adicionales:
   - `objectSrc: 'none'`
   - `baseUri: 'self'`
   - `frameAncestors: 'none'`
   - `formAction: 'self'`

No se introduce CSP con `nonce` por ahora: no hay necesidad (no se necesita JS
inline). Si en el futuro se introduce SSR con datos inline, se evaluará nonce-based.

## Consecuencias

- **Positivas:**
  - XSS reflejado/almacenado no puede ejecutarse vía `<script>` inline o `on*=`.
  - Defensa en profundidad real frente al robo del token Bearer.
  - Mejora la nota en `securityheaders.com` y `csp-evaluator.withgoogle.com`.
- **Negativas / coste:**
  - Cualquier desarrollador futuro que añada inline `style="..."` o `<script>`
    inline verá la app rota en consola (CSP violation). Aceptable: es el síntoma
    deseado.
- **Migración:** ninguna (no hay usuarios afectados).

## Verificación

- [x] Cambio en `src/web/server.ts` aplicado.
- [x] CSS añadido en `public/css/styles.css` (`.risk-{level}`).
- [x] JS actualizado en `public/js/app.js` (`renderAuditResults`).
- [ ] Verificación manual con DevTools en navegador: 0 errores de CSP.
- [ ] CSP Evaluator: grado A o superior.

## Referencias

- CRIT-05 en informe de auditoría.
- CSP Level 3 — W3C.
- OWASP Cheat Sheet: Content Security Policy.
- MDN: Programmatic CSS modifications and CSP.
