# 0.4 — Golden tests del formato `.scrypt`

## Por qué

Las Fases 1–2 cambiarán el KDF (Argon2id doble → HKDF) y la cabecera puede evolucionar a v2. Sin un **golden test** que congele el formato v0.3.0 (versión 1 en cabecera):

- No detectaríamos que un usuario actualizado de v0.3.0 ya no puede descifrar archivos previos.
- No tendríamos prueba de que la rama "legacy v1" sigue funcionando.

## Estrategia

Generamos en CI un fichero `.scrypt` con:

- `masterKey` fija (32 bytes, vector de test conocido).
- `salt` fija (16 bytes, vector de test conocido) — se inyecta vía mock o se acepta el aleatorio y solo se valida descifrado.
- `IV` fijo análogo.
- Contenido plaintext fijo: `"SecureCrypt golden vector v1\n"`.

Y verificamos:

1. **Cabecera** byte a byte (MAGIC, VERSION, params Argon2id, longitudes).
2. **Tamaño total** = HEADER_SIZE (128) + plaintext.length + AUTH_TAG_LENGTH (16).
3. **Decrypt** con la misma clave devuelve el plaintext original exacto.
4. **Decrypt con clave incorrecta** lanza `CryptoError` (auth tag falla).
5. **Decrypt con 1 byte modificado** lanza `CryptoError`.

## Archivo

Ubicación: `tests/regression/format-v1-scrypt.test.ts`

Ver el archivo creado en el repositorio. El test:

- Es **determinista** (mismas constantes en cada run).
- Es **rápido** (<200ms) — ejecuta en cada CI.
- No requiere ningún recurso externo.

## Migración futura

Cuando la Fase 2 introduzca cabecera v2 (HKDF):

1. **NO modificar** este test. Pasará a representar "puedo seguir descifrando v1".
2. Crear `tests/regression/format-v2-scrypt.test.ts` análogo para v2.
3. El decryptor debe detectar versión en cabecera y elegir KDF correcto.

## Si este test falla en Fase 1+

Significa que un cambio rompió retro-compatibilidad. Opciones:

1. **Restaurar** la compatibilidad (preferido).
2. **Documentar la rotura** vía ADR + script de migración para usuarios.
3. **Nunca** "ajustar" el test para que pase de nuevo sin entender por qué fallaba.
