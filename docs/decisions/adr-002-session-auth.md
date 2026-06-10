# ADR-002: Sistema de Sesión para la API REST

**Estado**: Propuesto  
**Fecha**: Junio 2026

---

## Contexto

La API REST actual requiere la contraseña maestra en cada petición HTTP. Esto expone la contraseña en logs, traces de observabilidad y middleware.

## Decisión

Implementar autenticación por sesión:
1. `POST /api/auth/login` recibe la contraseña, deriva la clave maestra, almacena solo la clave derivada en memoria con TTL
2. Devuelve un token opaco (UUID v4 criptográficamente seguro, NO JWT por simplicidad)
3. El token se incluye en el header `Authorization: Bearer <token>` de cada request
4. La sesión expira después de N minutos de inactividad (configurable, default 30)
5. `POST /api/auth/logout` invalida el token inmediatamente

## Almacenamiento de sesión
- En memoria (Map<token, { derivedKey, expiresAt, lastActivity }>)
- La clave derivada se limpia con `Buffer.fill(0)` al expirar
- No persiste en disco (seguridad > conveniencia)

## Consecuencias Positivas
- La contraseña maestra solo se transmite una vez
- Desaparece de todos los logs
- UX mejorada (no introducir contraseña en cada operación)

## Consecuencias Negativas
- Si el servidor se reinicia, todas las sesiones se invalidan (usuario debe volver a autenticarse)
- Requiere manejo de CSRF si se accede desde un navegador web

## Alternativas Rechazadas
- JWT: sobreingeniería para un servidor local, el estado de sesión de todas formas debe mantenerse en el servidor para poder invalidarlo
- Cookie + express-session con store persistente: requiere configuración adicional de seguridad de cookies
