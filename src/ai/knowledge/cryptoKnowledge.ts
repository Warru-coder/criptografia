export interface KnowledgeChunk {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  source: string;
}

export const KNOWLEDGE_BASE: KnowledgeChunk[] = [
  {
    id: 'aes-gcm-001',
    category: 'cipher',
    title: 'AES-256-GCM: cifrado autenticado',
    content: `AES-256-GCM (Advanced Encryption Standard con modo Galois/Counter Mode) es un cifrado AEAD (Authenticated Encryption with Associated Data). Proporciona confidencialidad e integridad simultáneamente. La clave tiene 256 bits (32 bytes). El authentication tag de 128 bits (16 bytes) detecta cualquier manipulación del ciphertext. El IV (nonce) de 12-16 bytes DEBE ser único por operación; reutilizar el mismo IV con la misma clave destruye completamente la seguridad. NIST recomienda IVs de 96 bits (12 bytes) para máxima eficiencia. AES-256-GCM es aprobado por NIST SP 800-38D y es el modo recomendado por defecto.`,
    keywords: ['aes', 'gcm', 'cifrado', 'aead', 'autenticado', 'iv', 'nonce', 'tag', 'clave', '256'],
    source: 'NIST SP 800-38D',
  },
  {
    id: 'aes-modes-001',
    category: 'cipher',
    title: 'Comparativa de modos AES: por qué GCM es superior a CBC/ECB',
    content: `ECB (Electronic Codebook) es inseguro: bloques idénticos de plaintext producen bloques idénticos de ciphertext, filtrando patrones. CBC (Cipher Block Chaining) proporciona confidencialidad pero NO integridad: un atacante puede manipular el ciphertext y descifrar sin detectarse (Padding Oracle Attack, BEAST). GCM proporciona ambas propiedades. Nunca usar ECB para datos reales. CBC requiere padding y gestión cuidadosa del IV. GCM no requiere padding y el authentication tag protege contra tampering.`,
    keywords: ['ecb', 'cbc', 'gcm', 'modo', 'padding', 'oracle', 'integridad', 'tampering', 'beast'],
    source: 'NIST SP 800-38A, NIST SP 800-38D',
  },
  {
    id: 'argon2id-001',
    category: 'kdf',
    title: 'Argon2id: el KDF recomendado por OWASP 2024',
    content: `Argon2id es el ganador de la Password Hashing Competition (2015) y el KDF recomendado por OWASP en 2024. Es resistente a ataques GPU, FPGA y ASIC gracias a su alto consumo de memoria. Parámetros mínimos OWASP: memoryCost=19456 KB (19 MB), timeCost=2, parallelism=1. Parámetros recomendados para alta seguridad: memoryCost=65536 KB (64 MB), timeCost=3, parallelism=2. La variante "id" combina resistencia a ataques de canal lateral (variante "i") y resistencia a ataques GPU (variante "d"). hashLength=32 bytes produce una clave de 256 bits perfecta para AES-256.`,
    keywords: ['argon2', 'argon2id', 'kdf', 'owasp', 'memorycost', 'timecost', 'parallelism', 'contraseña', 'derivacion'],
    source: 'OWASP Password Storage Cheat Sheet 2024, RFC 9106',
  },
  {
    id: 'pbkdf2-001',
    category: 'kdf',
    title: 'PBKDF2: parámetros seguros mínimos 2024',
    content: `PBKDF2 (Password-Based Key Derivation Function 2, RFC 8018) es más antiguo que Argon2id y menos resistente a ataques GPU ya que tiene consumo de memoria bajo y fijo. Para PBKDF2-HMAC-SHA256 OWASP 2024 requiere mínimo 600.000 iteraciones. Para PBKDF2-HMAC-SHA512: mínimo 210.000 iteraciones. Valores inferiores son inseguros para 2024. El salt debe ser único y aleatorio (>=128 bits). PBKDF2 es aceptable pero Argon2id es preferible si el entorno lo soporta. PBKDF2 con menos de 1000 iteraciones es criptográficamente débil y equivalente a hash sin salt.`,
    keywords: ['pbkdf2', 'iteraciones', 'hmac', 'sha256', 'sha512', 'kdf', 'salt', 'iteracion'],
    source: 'OWASP Password Storage Cheat Sheet 2024, RFC 8018',
  },
  {
    id: 'iv-nonce-001',
    category: 'iv',
    title: 'IV y Nonce: unicidad obligatoria',
    content: `El IV (Initialization Vector) o nonce debe ser único por cada operación de cifrado con la misma clave. En GCM, reutilizar un IV con la misma clave es catastrófico: permite al atacante recuperar la clave de autenticación y descifrar mensajes anteriores (nonce reuse attack). La solución recomendada es generar el IV aleatoriamente con un CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) de 12-16 bytes por cada operación. El IV puede transmitirse en claro junto al ciphertext (no es secreto, solo debe ser único). Con IVs aleatorios de 12 bytes, la probabilidad de colisión es despreciable hasta ~2^32 operaciones.`,
    keywords: ['iv', 'nonce', 'unico', 'reutilizar', 'gcm', 'aleatorio', 'csprng', 'colision', 'inicializacion'],
    source: 'NIST SP 800-38D, RFC 5116',
  },
  {
    id: 'salt-001',
    category: 'salt',
    title: 'Salt en KDF: por qué es obligatorio',
    content: `El salt es un valor aleatorio único que se añade a la contraseña antes de derivar la clave. Sin salt, contraseñas iguales producen el mismo hash (permite ataques de rainbow tables y diccionario con hashes precomputados). Con salt único por usuario/archivo, cada hash es diferente aunque las contraseñas sean iguales. El salt NO es secreto: puede almacenarse junto al hash. El salt mínimo recomendado es 128 bits (16 bytes) generado con CSPRNG. El salt no debe reutilizarse entre operaciones distintas. Argon2id y PBKDF2 aceptan el salt como parámetro explícito.`,
    keywords: ['salt', 'rainbow', 'tabla', 'diccionario', 'unico', 'aleatorio', 'hash', 'precomputado'],
    source: 'NIST SP 800-132, OWASP Password Storage Cheat Sheet',
  },
  {
    id: 'auth-tag-001',
    category: 'integrity',
    title: 'Authentication Tag en AEAD: detección de manipulación',
    content: `El authentication tag (etiqueta de autenticación) en AES-256-GCM es un MAC (Message Authentication Code) de 128 bits que cubre tanto el ciphertext como los datos adicionales (AAD). Permite detectar cualquier modificación del ciphertext durante el descifrado. Si el tag no coincide, el descifrado FALLA con error (la operación no produce datos). Usar un tag de menos de 128 bits (ej. 96 bits) reduce la seguridad. El tag se verifica en tiempo constante para prevenir timing attacks. GCM usa GHASH como función de autenticación, que es eficiente en hardware con instrucciones AES-NI.`,
    keywords: ['tag', 'autenticacion', 'mac', 'integridad', 'manipulacion', 'gmac', 'ghash', 'tamper', 'autenticado'],
    source: 'NIST SP 800-38D',
  },
  {
    id: 'timing-attack-001',
    category: 'security',
    title: 'Timing Attack: vulnerabilidad de canal lateral por tiempo',
    content: `Un timing attack (ataque de temporización) aprovecha diferencias medibles en el tiempo de ejecución de operaciones criptográficas para inferir información secreta. Ejemplo clásico: comparar hashes con el operador == en muchos lenguajes termina en cuanto encuentra el primer byte diferente (early exit). Un atacante puede medir el tiempo de comparación para adivinar bytes del hash uno a uno. La solución es usar comparación de tiempo constante (constant-time comparison): comparar TODOS los bytes independientemente de si coinciden (XOR sobre todos los bytes, no early exit). En Python: hmac.compare_digest(). En C: memcmp() NO es seguro, usar funciones específicas como CRYPTO_memcmp de OpenSSL.`,
    keywords: ['timing', 'canal lateral', 'tiempo constante', 'comparacion', 'early exit', 'side channel', 'hash'],
    source: 'CWE-208, NIST SP 800-140C',
  },
  {
    id: 'path-traversal-001',
    category: 'security',
    title: 'Path Traversal: cómo prevenirlo en aplicaciones de cifrado',
    content: `Un ataque de path traversal (directory traversal) permite a un atacante acceder a archivos fuera del directorio esperado usando secuencias como "../" en los parámetros de ruta. En aplicaciones de cifrado, esto es crítico: el atacante puede cifrar o descifrar archivos del sistema operativo. Mitigación: (1) resolver la ruta con path.resolve() o equivalente, (2) verificar que la ruta resuelta comienza con el directorio base autorizado, (3) rechazar rutas absolutas proporcionadas por el usuario, (4) usar listas blancas de directorios permitidos. OWASP clasifica esto como A01:2021 Broken Access Control.`,
    keywords: ['path traversal', 'directory traversal', 'sandbox', 'ruta', 'acceso', 'owasp', 'a01'],
    source: 'OWASP Top 10 A01:2021, CWE-22',
  },
  {
    id: 'key-management-001',
    category: 'keymanagement',
    title: 'Gestión de claves: ciclo de vida y almacenamiento seguro',
    content: `Las claves criptográficas deben: (1) generarse con CSPRNG, nunca con PRNG simple, (2) tener una vida útil limitada (rotación periódica), (3) almacenarse cifradas (nunca en texto claro en disco), (4) limpiarse de memoria con SecureZeroMemory/explicit_bzero después de usar (el GC no garantiza limpieza inmediata), (5) nunca registrarse en logs, (6) separar clave de cifrado de clave de autenticación. Windows DPAPI y Android Keystore son mecanismos del SO para proteger claves ligadas al usuario/dispositivo. PKCS#11 y HSMs son la solución empresarial.`,
    keywords: ['clave', 'gestion', 'rotacion', 'dpapi', 'keystore', 'hsm', 'pkcs11', 'almacenamiento', 'memoria'],
    source: 'NIST SP 800-57, OWASP Cryptographic Storage Cheat Sheet',
  },
  {
    id: 'streaming-encryption-001',
    category: 'implementation',
    title: 'Cifrado en streaming: cómo cifrar archivos grandes',
    content: `Para cifrar archivos grandes sin cargar todo el contenido en memoria, se usa cifrado en streaming. AES-256-GCM en modo streaming divide el archivo en chunks y los cifra secuencialmente. El authentication tag se calcula sobre todo el ciphertext. El IV se almacena en el header del archivo cifrado. Para descifrar, se lee el IV del header, se descifra el contenido y se verifica el tag al final. Si el tag no coincide, el archivo fue manipulado y no se devuelven los datos. Node.js permite implementar esto con streams de Transform. La ventaja es O(1) uso de memoria independientemente del tamaño del archivo.`,
    keywords: ['streaming', 'chunks', 'archivo grande', 'memoria', 'transform', 'stream', 'node'],
    source: 'Node.js crypto documentation, NIST SP 800-38D',
  },
  {
    id: 'secure-random-001',
    category: 'randomness',
    title: 'Generación de números aleatorios criptográficamente seguros (CSPRNG)',
    content: `Un CSPRNG (Cryptographically Secure Pseudo-Random Number Generator) es obligatorio para generar IVs, salts y claves. Los PRNG simples (Math.random() en JavaScript, rand() en C) son predecibles y NO deben usarse para criptografía. En Node.js: crypto.randomBytes(n). En Python: os.urandom(n) o secrets.token_bytes(n). En Java: SecureRandom. En C++/Windows: BCryptGenRandom() o RtlGenRandom(). En Android: java.security.SecureRandom. El sistema operativo obtiene entropía de eventos hardware (interrupciones, red, disco). Usar Math.random() o similar para IVs es una vulnerabilidad crítica.`,
    keywords: ['csprng', 'aleatorio', 'entropia', 'iv', 'salt', 'seguro', 'randomBytes', 'SecureRandom', 'predecible'],
    source: 'NIST SP 800-90A, FIPS 140-2',
  },
  {
    id: 'owasp-asvs-001',
    category: 'compliance',
    title: 'OWASP ASVS: controles de seguridad criptográfica',
    content: `OWASP ASVS (Application Security Verification Standard) incluye controles específicos para criptografía en la sección V6: (1) V6.2.1 - todos los módulos criptográficos fallan de forma segura, (2) V6.2.2 - se usan generadores de números aleatorios seguros, (3) V6.2.3 - IV generado aleatoriamente, (4) V6.2.4 - derivación de claves usa KDF estándar (Argon2id), (5) V6.2.5 - no se usan modos inseguros (ECB, RC4, MD5, SHA1 para seguridad), (6) V6.2.6 - no se implementa criptografía personalizada. ASVS nivel 1 es mínimo para aplicaciones públicas, nivel 2 para aplicaciones con datos sensibles, nivel 3 para aplicaciones críticas.`,
    keywords: ['owasp', 'asvs', 'v6', 'controles', 'verificacion', 'nivel', 'estandar', 'cumplimiento'],
    source: 'OWASP ASVS 4.0.3',
  },
  {
    id: 'gdpr-encryption-001',
    category: 'compliance',
    title: 'GDPR y cifrado: Artículo 32 y medidas técnicas',
    content: `El Reglamento General de Protección de Datos (GDPR) artículo 32 requiere "cifrado de datos personales" como medida técnica apropiada. El cifrado no exonera de notificar una brecha de datos, pero puede reducir el riesgo y potencialmente evitar la notificación a afectados si los datos están correctamente cifrados y las claves están seguras (considerando 83). La CNIL (Francia) y la AEPD (España) consideran AES-256 con gestión adecuada de claves como medida técnica suficiente. El cifrado debe implementarse "state of the art" — lo que implica usar Argon2id en 2024 en lugar de MD5 o SHA1. Una brecha con datos bien cifrados puede no requerir notificación individual.`,
    keywords: ['gdpr', 'rgpd', 'articulo 32', 'proteccion datos', 'brecha', 'notificacion', 'cifrado', 'aepd'],
    source: 'GDPR Art. 32, Considerando 83',
  },
  {
    id: 'format-scrypt-001',
    category: 'implementation',
    title: 'Formato de archivo .scrypt: estructura del header',
    content: `SecureCrypt usa el formato .scrypt con un header de 128 bytes: bytes 0-5 magic "SCRYPT", byte 6 versión (1), bytes 7-22 salt Argon2id (16 bytes CSPRNG único por archivo), bytes 23-38 IV AES-GCM (16 bytes CSPRNG único por operación), bytes 39-42 memoryCost Argon2id (uint32 LE), byte 43 timeCost, byte 44 parallelism, bytes 45-52 reservados (ceros), bytes 53-54 longitud nombre original (uint16 LE), bytes 55+ nombre original en UTF-8. El ciphertext sigue al header. Los últimos 16 bytes del archivo son el authentication tag GCM. El salt e IV están en el header en claro (no son secretos, solo deben ser únicos). Sin la contraseña correcta no es posible derivar la clave ni descifrar.`,
    keywords: ['scrypt', 'formato', 'header', 'magic', 'salt', 'iv', 'tag', 'argon2', 'binario', 'estructura'],
    source: 'SecureCrypt v0.3 - formato interno',
  },
];

export function searchKnowledge(query: string, topK = 3): KnowledgeChunk[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

  const scored = KNOWLEDGE_BASE.map(chunk => {
    let score = 0;
    const text = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`.toLowerCase();

    for (const word of queryWords) {
      const occurrences = (text.match(new RegExp(word, 'g')) ?? []).length;
      score += occurrences;
    }

    for (const keyword of chunk.keywords) {
      if (queryLower.includes(keyword)) score += 3;
    }

    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .filter(s => s.score > 0)
    .map(s => s.chunk);
}
