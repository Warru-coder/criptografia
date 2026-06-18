# ADR-0010: Rate-limit con keyGenerator compuesto (IP + username)

- **Estado:** Aceptado
- **Fecha:** 2026-06-18
- **Fase:** 2

## Contexto

Hallazgo ALTA-07: el rate-limit de `/api/auth/` usaba la IP como única clave. Dos vectores quedaban abiertos:

1. **Spraying desde una IP** contra muchos usuarios: un único contador por IP saturado con 10 intentos de 10 usuarios distintos no permite atacar más cuentas, pero **se queda corto** para detectar el patrón "muchos usuarios, 1 intento cada uno".
2. **Brute-force distribuido** contra un usuario: muchas IPs (botnet, Tor) hacen 1 intento cada una contra `alice` → cada IP solo tiene 1 hit, nunca se bloquea.

## Decisión

`keyGenerator` que combine IP y username:

```ts
keyGenerator: (req) => {
  const body = (req as unknown as { body?: { username?: unknown } }).body;
  const rawName = typeof body?.username === 'string' ? body.username : '';
  const uname = rawName.trim().toLowerCase().slice(0, 64) || '<anon>';
  const ip = req.ip ?? 'unknown';
  return `${ip}|${uname}`;
},
```

Cada par `(ip, username)` tiene su propio bucket de 10 intentos/15 min. Spraying queda detectable por bucket; distributed brute-force queda detectable porque todos los buckets `(*, alice)` comparten el username (a futuro se añadirá un slow-down secundario keyed solo por username — Fase 4).

## Consecuencias

- **Positivas:** brute-force y spraying mucho más caros.
- **Negativas:** ligero crecimiento de memoria en el store de rate-limit (lineal con #(ips × usernames únicos)).
- **Migración:** ninguna.

## Pendiente (Fase 4)

- Añadir `express-slow-down` con incremento exponencial.
- Logging estructurado al pasar de 5 fallos consecutivos del mismo username.
- Bloqueo temporal explícito del username tras N fallos.

## Referencias

- ALTA-07 en informe.
- OWASP Authentication Cheat Sheet.
