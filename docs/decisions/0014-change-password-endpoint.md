# ADR-0014: Endpoint de cambio de contraseña con rotación atómica

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 3

## Contexto

Hallazgo MED-04: no había endpoint para cambiar la contraseña. Esto significa:
- No se pueden rotar credenciales tras una sospecha de compromiso.
- No se pueden invalidar sesiones tras un cambio de password (ni siquiera había forma de cambiarlo).
- Las wrappedKeys de WebAuthn quedarían "huérfanas" (siguen descifrando con la masterKey vieja).

## Decisión

Nuevo endpoint `POST /api/auth/change-password`:

```
Body: { currentPassword, newPassword }
Auth: Bearer (existing session)
Effect:
  1. Verificar currentPassword.
  2. Validar newPassword (NIST policy, ADR-0011).
  3. Re-derivar y persistir vault hash + masterSalt atomicamente (write-rename).
  4. Invalidar TODAS las sesiones del usuario.
  5. Limpiar wrappedKey (passkey requiere re-link).
  6. Crear sesión nueva con la nueva masterKey y devolver token.
Returns: { sessionToken, expiresAt, userId, passkeyResetRequired: true }
```

## Decisiones de detalle

- **¿Invalidar tambien la sesión actual?** Sí — y crear una nueva sesión con
  la nueva masterKey en la misma respuesta. El cliente solo tiene que cambiar
  su token sin re-loguearse. Esto evita el bug clásico "cambio de password
  pero la sesión vieja sigue con la masterKey antigua en memoria del servidor".
- **¿Descartar wrappedKey?** Sí — la wrappedKey antigua descifra a la masterKey
  antigua (ya inválida). El usuario debe re-vincular su passkey haciendo un
  registro de credential nuevo desde la sesión nueva.

## Consecuencias

- **Positivas:** rotación segura y atómica.
- **Negativas:** los usuarios con passkey tienen que re-registrarla. Aceptable:
  es el comportamiento esperado tras una rotación de credenciales.

## Verificación

- [x] `tests/integration/changePassword.test.ts`: 5 escenarios — registro, OK,
  password actual incorrecta, password nueva débil, token viejo invalidado,
  login con nueva funciona y con vieja no.

## Referencias

- MED-04 en informe.
- OWASP Authentication Cheat Sheet — Password Change.
