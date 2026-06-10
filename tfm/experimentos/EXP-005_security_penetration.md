# EXP-005: Test de Penetración Básico

**Estado**: Parcialmente ejecutado (verificación de correcciones Fase 0)  
**Capítulo relacionado**: 8.6

## Objetivo

Verificar que las correcciones de seguridad de Fase 0 son efectivas contra los vectores de ataque identificados en el análisis inicial.

## Entorno de prueba

```bash
# Iniciar servidor en modo test
cd C:\Users\Gabriel\Desktop\criptografia
npm run build && node dist/web/server.js
# Servidor en http://localhost:3000
```

## Test SEC-001: Path Traversal

### Prerequisitos
- Vault inicializado
- Sesión activa con `TOKEN`

### Payload malicioso 1: subida de directorio

```bash
curl -X POST http://localhost:3000/api/encrypt-dir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputPath": "../../Windows/System32"}'
```

**Resultado esperado**: `403 Forbidden` + `{"error": "Path outside sandbox"}`

### Payload malicioso 2: path con null byte

```bash
curl -X POST http://localhost:3000/api/encrypt-dir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputPath": "testdir\x00../../etc"}'
```

**Resultado esperado**: `403 Forbidden` o `400 Bad Request`

### Payload malicioso 3: path con symlink

```bash
# Crear symlink que apunta fuera del directorio base
mklink /D C:\Users\Gabriel\Documents\evil C:\Windows\System32
curl -X POST http://localhost:3000/api/encrypt-dir \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"inputPath": "C:/Users/Gabriel/Documents/evil"}'
```

**Resultado esperado**: `403 Forbidden` (path.resolve resuelve symlinks en Windows)

## Test SEC-002: Autenticación

### Sin token

```bash
curl -X POST http://localhost:3000/api/encrypt \
  -F "file=@testfile.txt"
```

**Resultado esperado**: `401 Unauthorized` + `{"error": "Authentication required"}`

### Token inválido

```bash
curl -X POST http://localhost:3000/api/encrypt \
  -H "Authorization: Bearer aaaa1111bbbb2222cccc3333dddd4444eeee5555ffff6666aaaa1111bbbb2222" \
  -F "file=@testfile.txt"
```

**Resultado esperado**: `401 Unauthorized` + `{"error": "Invalid or expired session"}`

### Token expirado

Esperar 31 minutos después de login y reutilizar el token.

**Resultado esperado**: `401 Unauthorized`

## Test SEC-003: Brute Force

```bash
# 101 requests en 15 minutos al mismo endpoint
for i in {1..101}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"password": "wrong"}'
done
```

**Resultado esperado**: Request 101 devuelve `429 Too Many Requests`

## Test SEC-004: Integridad del ciphertext

```python
# Modificar 1 byte del ciphertext y verificar que descifrado falla
import requests, struct

with open('test.txt', 'w') as f:
    f.write('A' * 1000)

# Cifrar
r = requests.post('http://localhost:3000/api/encrypt',
    headers={'Authorization': f'Bearer {TOKEN}'},
    files={'file': open('test.txt', 'rb')})
with open('test.scrypt', 'wb') as f:
    f.write(r.content)

# Corromper byte 150
with open('test.scrypt', 'r+b') as f:
    f.seek(150)
    b = f.read(1)
    f.seek(150)
    f.write(bytes([b[0] ^ 0x01]))

# Descifrar — debe fallar
r = requests.post('http://localhost:3000/api/decrypt',
    headers={'Authorization': f'Bearer {TOKEN}'},
    files={'file': open('test.scrypt', 'rb')})
assert r.status_code == 500
assert 'Authentication tag' in r.json()['error']
```

**Resultado esperado**: `500 Internal Server Error` con mensaje de error de autenticación

## Resultados

| Test | Vulnerabilidad | Resultado antes Fase 0 | Resultado después |
|------|---------------|----------------------|------------------|
| SEC-001-A | Path traversal básico | VULNERABLE | |
| SEC-001-B | Path traversal null byte | VULNERABLE | |
| SEC-001-C | Path traversal symlink | VULNERABLE | |
| SEC-002-A | Sin autenticación | VULNERABLE | |
| SEC-002-B | Token inválido | VULNERABLE | |
| SEC-002-C | Token expirado | N/A (no existía) | |
| SEC-003 | Brute force login | VULNERABLE | |
| SEC-004 | Integridad ciphertext | Parcialmente mitigado | |

_[Completar con resultados reales de los tests]_
