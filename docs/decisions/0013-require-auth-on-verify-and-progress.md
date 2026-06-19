# ADR-0013: Autenticación y aislamiento por usuario en `/api/verify` y `/api/progress`

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 3

## Contexto

Dos hallazgos del informe:

- **ALTA-09:** `/api/verify` aceptaba uploads sin sesión, sin límite específico
  → DoS trivial subiendo gigabytes desde IPs anónimas.
- **MED-05:** `/api/progress` (SSE) era un canal global; cualquier cliente
  recibía el progreso de cualquier otro usuario incluyendo nombres de fichero.

## Decisión

1. **`/api/verify`** ahora exige `requireSession` y usa un multer dedicado con
   límite de 1 MiB (más que suficiente: solo se leen los primeros 148 bytes de
   la cabecera). El handler abre el fichero, lee 148 bytes con `fd.read`, y
   no carga el resto en memoria.
2. **`/api/progress`** exige `requireSession`. El canal SSE se mantiene en un
   `Map<userId, Set<Response>>`. `broadcastProgress(userId, payload)` solo
   escribe en el set del usuario propietario. Los handlers de encrypt/decrypt
   pasan `req.userId` al broadcast.

## Consecuencias

- Adiós al canal anónimo de progreso. Adiós al hueco DoS de `/verify`.
- Cambio en la firma exportada de `broadcastProgress`: ahora requiere
  `userId` como primer parámetro. Cualquier llamada externa debe actualizarse.

## Verificación

- [x] Tests `auth.test.ts` siguen pasando (no llaman a verify/progress).
- [ ] Test e2e con SSE + multi-usuario (pendiente harness con dos sesiones simultáneas).

## Referencias

- ALTA-09, MED-05 en informe.
