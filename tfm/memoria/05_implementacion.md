# Capítulo 5: Implementación del Sistema de Cifrado

## 5.1 Stack tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Runtime | Node.js | ≥ 20 LTS | Streams nativos, crypto module, soporte AES-NI |
| Lenguaje | TypeScript | 5.x | Tipado estático, NodeNext modules |
| Web framework | Express | 4.x | Maduro, middleware ecosystem |
| Cifrado | Node.js crypto | Built-in | AES-256-GCM nativo, sin dependencias externas |
| KDF | argon2 npm | 0.40.x | Binding nativo Argon2id, rendimiento óptimo |
| Base de datos | better-sqlite3 | 12.x | Síncrona, WAL mode, sin servidor |
| Autenticación FIDO2 | @simplewebauthn/server | 13.x | Passkeys W3C WebAuthn Level 2 |
| Configuración | dotenv | 17.x | Config desde .env, sin cambios de código |
| Seguridad HTTP | helmet + cors | latest | Headers + CORS controlado |
| Rate limiting | express-rate-limit | 7.x | Protección DoS, límite separado para login |
| Uploads | multer | 1.4.x | Streaming multipart |
| Logging | winston | 3.x | Rotación automática, JSON estructurado |
| Tests | vitest | 2.x | Compatible con TypeScript ESM/CJS |
| Contenedores | Docker + nginx | latest | Despliegue reproducible |

## 5.2 Módulo de cifrado (src/crypto/)

### 5.2.1 Cabecera del archivo .scrypt

```typescript
// src/crypto/fileHeader.ts
export const MAGIC = Buffer.from('SCRYPT');
export const VERSION = 0x01;
export const HEADER_SIZE = 80; // bytes fijos antes del payload

export interface FileHeader {
  magic: string;      // 'SCRYPT'
  version: number;    // 1
  memoryCost: number; // Argon2id
  timeCost: number;
  parallelism: number;
  keyLength: number;  // siempre 32
  saltLength: number; // siempre 32
  ivLength: number;   // siempre 12
  salt: Buffer;       // 32 bytes
  iv: Buffer;         // 12 bytes
}
```

### 5.2.2 Cifrado con streaming

El cifrado en streaming permite procesar archivos de cualquier tamaño sin cargar todo en memoria:

```typescript
// src/crypto/fileCipher.ts — flujo simplificado
export async function encryptFile(
  inputPath: string,
  outputPath: string,
  masterKey: Buffer,
  onProgress?: (p: EncryptProgress) => void
): Promise<void> {
  const salt = crypto.randomBytes(ARGON2_PARAMS.saltLength);
  const iv = crypto.randomBytes(ARGON2_PARAMS.ivLength);

  // Derivar clave desde masterKey + salt
  const fileKey = await argon2.hash(masterKey, {
    type: argon2.argon2id,
    salt,
    memoryCost: ARGON2_PARAMS.memoryCost,
    timeCost: ARGON2_PARAMS.timeCost,
    parallelism: ARGON2_PARAMS.parallelism,
    hashLength: ARGON2_PARAMS.keyLength,
    raw: true,
  });

  const cipher = crypto.createCipheriv('aes-256-gcm', fileKey, iv);
  cipher.setAAD(buildHeader(salt, iv)); // AAD autentica la cabecera

  const input = fs.createReadStream(inputPath);
  const output = fs.createWriteStream(outputPath);

  writeHeader(output, salt, iv);

  await pipeline(
    input,
    new Transform({ transform(chunk, _, cb) {
      onProgress?.(computeProgress(chunk));
      cb(null, cipher.update(chunk));
    }}),
    output
  );

  output.write(cipher.final());
  output.write(cipher.getAuthTag()); // 16 bytes al final
  fileKey.fill(0); // SEC: limpiar clave derivada
}
```

**Nota de seguridad**: El tag de autenticación GCM (16 bytes) se escribe al final del archivo. Durante el descifrado, DEBE verificarse antes de devolver cualquier dato al usuario. Esto previene ataques de padding oracle y modificación del texto cifrado.

### 5.2.3 Descifrado con verificación del tag

```typescript
// src/crypto/fileDecipher.ts — punto crítico
export async function decryptFile(...): Promise<void> {
  const header = readHeader(inputPath);
  // ...
  const decipher = crypto.createDecipheriv('aes-256-gcm', fileKey, header.iv);
  decipher.setAAD(buildHeader(header.salt, header.iv));

  // Leer tag de los últimos 16 bytes ANTES de iniciar el streaming
  const authTag = readLastBytes(inputPath, 16);
  decipher.setAuthTag(authTag);

  // Si el tag no es válido, Node lanzará una excepción al llamar final()
  try {
    await pipeline(ciphertextStream, decipher, outputStream);
    decipher.final(); // lanza si tag inválido
  } catch (err) {
    await fs.promises.unlink(outputPath); // eliminar output parcial
    throw new AuthTagError('Authentication tag verification failed');
  }
}
```

## 5.3 Base de datos SQLite (src/database/)

### 5.3.1 Esquema

```sql
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  username    TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,   -- Argon2id hash
  salt        TEXT NOT NULL,
  wrappedKey  TEXT,             -- AES-256-GCM(masterKey, serverSecret) para WebAuthn
  createdAt   TEXT NOT NULL,
  lastLoginAt TEXT
);

CREATE TABLE sessions (
  token     TEXT PRIMARY KEY,
  userId    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expiresAt INTEGER NOT NULL,   -- ms since epoch
  createdAt INTEGER NOT NULL
);

CREATE TABLE webauthn_credentials (
  id           TEXT PRIMARY KEY,
  userId       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credentialId TEXT NOT NULL,   -- base64url
  publicKey    TEXT NOT NULL,   -- base64
  counter      INTEGER NOT NULL,
  deviceType   TEXT NOT NULL,
  backedUp     INTEGER NOT NULL,
  createdAt    TEXT NOT NULL
);
```

### 5.3.2 Sesiones híbridas

Los tokens de sesión se persisten en SQLite con `(token, userId, expiresAt)`. La clave maestra **nunca** se guarda en disco — solo vive en un `Map<string, { masterKey, userId }>` en memoria. Tras un reinicio del servidor, los tokens en SQLite son inválidos funcionalmente porque la clave no está en memoria: el usuario debe hacer login de nuevo.

## 5.4 Gestión de contraseñas (src/passwordManager/)

### 5.4.1 Vault por usuario

Cada usuario tiene su vault en `{dataDir}/users/{userId}/vault/master.hash` con el hash Argon2id de su contraseña. El hash permite:
1. **Verificar** la contraseña sin almacenarla
2. **Derivar** la clave maestra (re-ejecutando Argon2id con el mismo salt)

```typescript
// src/passwordManager/secureStorage.ts
export async function setupMasterPassword(userId: string, password: string): Promise<void> {
  const { hash, salt } = await deriveKeyForStorage(password);
  const record = {
    algorithm: 'argon2id',
    version: 19,
    params: { memoryCost: 65536, timeCost: 3, parallelism: 2 },
    hash,
    salt: salt.toString('base64'),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(vaultFilePath(userId), JSON.stringify(record, null, 2), 'utf-8');
}
```

### 5.4.2 Sesiones híbridas (SQLite + memoria)

```typescript
// src/web/session/sessionStore.ts
export function createSession(masterKey: Buffer, userId: string): string {
  const token = crypto.randomBytes(32).toString('hex'); // 256 bits
  persistSession(token, userId);             // SQLite: token, userId, expiresAt
  mem.set(token, { masterKey: Buffer.from(masterKey), userId }); // RAM: clave
  return token;
}

export function getSession(token: string): Session | undefined {
  const entry = mem.get(token);
  if (!entry) return undefined;
  if (!touchSession(token)) {    // SQLite: verificar + deslizar TTL
    entry.masterKey.fill(0);
    mem.delete(token);
    return undefined;
  }
  return entry;
}
```

**Propiedades de seguridad**:
- Token de 256 bits de entropía
- TTL deslizante por cada request (default 30 min, configurable)
- Clave maestra nunca sale de RAM
- `masterKey.fill(0)` al expirar o hacer logout

## 5.5 Middleware de seguridad

### 5.5.1 requireSession

```typescript
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' }); return;
  }
  const session = getSession(authHeader.slice(7));
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid' }); return;
  }
  req.masterKey = session.masterKey;
  req.userId = session.userId;
  next();
}
```

### 5.5.2 pathSandbox — Protección contra path traversal (SEC-001)

```typescript
// BASE_DIR leído de env.dataDir (configurable en .env)
const BASE_DIR = path.resolve(env.dataDir);

export function sandboxPath(userInput: string): string {
  const resolved = path.resolve(userInput);
  if (resolved !== BASE_DIR && !resolved.startsWith(BASE_DIR + path.sep)) {
    throw new ForbiddenPathError(`Access denied: path outside ${BASE_DIR}`);
  }
  return resolved;
}
```

**Corrección SEC-001**: `path.resolve()` normaliza `..` y symlinks antes de la comprobación de prefijo. Sin esta función, un atacante autenticado podría cifrar `/etc/passwd` enviando `../../etc/passwd`.

### 5.5.3 Rate limiting en autenticación

```typescript
// server.ts — límite más estricto para /api/auth/
app.use('/api/auth/', rateLimit({
  windowMs: env.rateLimitWindowMs,  // default: 15 min
  max: env.loginRateLimitMax,       // default: 10 intentos
  skip: (req) => req.path === '/logout',
}));
```

Configuración separada para login/register (10 req/15min) vs API general (100 req/15min).

### 5.5.4 WebAuthn (FIDO2)

Registro de passkey vinculado a una sesión de contraseña activa. La clave maestra se envuelve con `SERVER_SECRET` (AES-256-GCM) y se guarda en `users.wrappedKey`:

```typescript
function wrapMasterKey(masterKey: Buffer): string {
  const secret = Buffer.from(env.serverSecret.padEnd(32,'0').slice(0,32));
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);
  const enc = Buffer.concat([cipher.update(masterKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64'); // iv(12)+tag(16)+enc
}
```

En login posterior con passkey, `unwrapMasterKey()` recupera la clave maestra sin pedir contraseña.

## 5.6 Tests unitarios

```typescript
// tests/crypto.test.ts — extracto
describe('encryptFile / decryptFile', () => {
  it('round-trip mantiene integridad del contenido', async () => {
    const key = crypto.randomBytes(32);
    await encryptFile(input, encrypted, key);
    await decryptFile(encrypted, decrypted, key);
    expect(fs.readFileSync(decrypted)).toEqual(fs.readFileSync(input));
  });

  it('lanza AuthTagError si el ciphertext es modificado', async () => {
    const key = crypto.randomBytes(32);
    await encryptFile(input, encrypted, key);
    // Corromper un byte del ciphertext
    const buf = fs.readFileSync(encrypted);
    buf[100] ^= 0x01;
    fs.writeFileSync(encrypted, buf);
    await expect(decryptFile(encrypted, decrypted, key)).rejects.toThrow('Authentication tag');
  });
});
```

**Cobertura actual**: Los módulos `fileCipher`, `fileDecipher`, `passwordValidator` y `configAuditor` tienen tests. El objetivo es ≥ 80% de cobertura de líneas en módulos de dominio.
