# Capítulo 5: Implementación del Sistema de Cifrado

## 5.1 Stack tecnológico

| Capa | Tecnología | Versión | Justificación |
|------|-----------|---------|---------------|
| Runtime | Node.js | ≥ 18 LTS | Streams nativos, crypto module, soporte AES-NI |
| Lenguaje | TypeScript | 5.x | Tipado estático, NodeNext modules |
| Web framework | Express | 4.x | Maduro, middleware ecosystem |
| Cifrado | Node.js crypto | Built-in | AES-256-GCM nativo, sin dependencias externas |
| KDF | argon2 npm | latest | Binding nativo Argon2id, rendimiento óptimo |
| Seguridad HTTP | helmet | latest | Headers de seguridad automáticos |
| Rate limiting | express-rate-limit | latest | Protección DoS básica |
| Uploads | multer | latest | Streaming multipart |
| Tests | Jest + ts-jest | latest | Integración TypeScript nativa |

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

## 5.3 Gestión de contraseñas (src/passwordManager/)

### 5.3.1 Almacenamiento seguro

```typescript
// src/passwordManager/secureStorage.ts
export async function setupMasterPassword(password: string): Promise<void> {
  const salt = crypto.randomBytes(32);
  const hash = await argon2.hash(password, {
    type: argon2.argon2id,
    salt,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 2,
    hashLength: 32,
  });

  // Almacenar salt + hash en ~/.securecrypt/hash.dat
  const data = JSON.stringify({
    salt: salt.toString('hex'),
    hash: hash,
    version: 1,
  });
  await fs.promises.writeFile(HASH_FILE, data, { mode: 0o600 });
}
```

**Propiedad de seguridad**: El archivo `hash.dat` nunca contiene la contraseña en texto claro ni la clave maestra. El hash Argon2id es computacionalmente costoso de verificar por fuerza bruta (~300ms por intento en hardware moderno).

### 5.3.2 Derivación de la clave maestra

```typescript
export async function getMasterKey(password: string): Promise<Buffer> {
  const { salt } = readHashFile();
  const key = await argon2.hash(password, {
    type: argon2.argon2id,
    salt: Buffer.from(salt, 'hex'),
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 2,
    hashLength: 32,
    raw: true, // devuelve Buffer, no string
  });
  return key as Buffer;
}
```

**Importante**: `getMasterKey` solo se llama en `authRoutes.ts` durante el login. La clave maestra se almacena en memoria únicamente durante la vida de la sesión (SessionStore) y se limpia al hacer logout o expirar la sesión.

## 5.4 Sesiones y autenticación (src/web/session/)

### 5.4.1 SessionStore en memoria

```typescript
// src/web/session/sessionStore.ts
interface Session {
  masterKey: Buffer;
  createdAt: number;
  lastUsed: number;
}

const store = new Map<string, Session>();
export const SESSION_TTL_MS = 30 * 60_000; // 30 min

export function createSession(masterKey: Buffer): string {
  const token = crypto.randomBytes(32).toString('hex'); // 256-bit entropy
  store.set(token, { masterKey, createdAt: Date.now(), lastUsed: Date.now() });
  return token;
}

export function getSession(token: string): Session | undefined {
  const session = store.get(token);
  if (!session) return undefined;
  if (Date.now() - session.lastUsed > SESSION_TTL_MS) {
    session.masterKey.fill(0); // limpiar clave de memoria
    store.delete(token);
    return undefined;
  }
  session.lastUsed = Date.now(); // sliding TTL
  return session;
}
```

**Propiedades de seguridad**:
- Token de 64 caracteres hex = 256 bits de entropía (imposible adivinar por fuerza bruta)
- TTL deslizante: la sesión se extiende con cada request, expira por inactividad
- La clave maestra se borra de memoria (`fill(0)`) al expirar la sesión
- Sin persistencia en disco (reiniciar servidor invalida todas las sesiones)

## 5.5 Middleware de seguridad

### 5.5.1 requireSession

```typescript
// src/web/middleware/requireSession.ts
export function requireSession(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.slice(7);
  const session = getSession(token);
  if (!session) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.masterKey = session.masterKey;
  next();
}
```

### 5.5.2 pathSandbox — Protección contra path traversal

```typescript
// src/web/middleware/pathSandbox.ts
const BASE_DIR = path.resolve(process.env.SECURECRYPT_BASE_DIR ?? os.homedir());

export function sandboxPath(userInput: string): string {
  const resolved = path.resolve(userInput);
  // Verificar que la ruta esté DENTRO del directorio base
  if (resolved !== BASE_DIR && !resolved.startsWith(BASE_DIR + path.sep)) {
    throw new ForbiddenPathError(
      `Path '${userInput}' is outside the allowed base directory`
    );
  }
  return resolved;
}
```

**Vulnerabilidad original**: El código pre-Fase 0 pasaba `inputPath` directamente a `fs.existsSync()` y `encryptDirectory()` sin validación. Esto permitía a un atacante autenticado cifrar o descifrar cualquier directorio del sistema.

**Corrección**: Toda ruta recibida del cliente pasa por `sandboxPath()` antes de cualquier operación de filesystem. `path.resolve()` elimina los segmentos `..` y symlinks, y la comprobación de prefijo garantiza que la ruta resultante esté dentro del directorio base.

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
