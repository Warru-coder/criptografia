# EXP-002: Throughput AES-256-GCM — Rendimiento de cifrado

**Estado**: Pendiente de ejecución  
**Capítulo relacionado**: 8.3

## Objetivo

Medir el throughput de cifrado y descifrado para archivos de diferentes tamaños, con y sin aceleración AES-NI hardware.

## Protocolo

```typescript
// tests/benchmarks/aesThroughput.ts
import { encryptFile, decryptFile } from '../../src/crypto/fileCipher';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const SIZES = [
  { name: '1 MB', bytes: 1 * 1024 * 1024 },
  { name: '10 MB', bytes: 10 * 1024 * 1024 },
  { name: '100 MB', bytes: 100 * 1024 * 1024 },
  { name: '1 GB', bytes: 1024 * 1024 * 1024 },
];

const tmpDir = os.tmpdir();

for (const { name, bytes } of SIZES) {
  const inputPath = path.join(tmpDir, `bench-input-${bytes}`);
  const encPath = path.join(tmpDir, `bench-enc-${bytes}`);
  const decPath = path.join(tmpDir, `bench-dec-${bytes}`);

  // Generar archivo de prueba con bytes aleatorios
  fs.writeFileSync(inputPath, crypto.randomBytes(bytes));
  const key = crypto.randomBytes(32);

  // Medir cifrado
  const t0 = performance.now();
  await encryptFile(inputPath, encPath, key);
  const encMs = performance.now() - t0;
  const encMBs = (bytes / (1024 * 1024)) / (encMs / 1000);

  // Medir descifrado
  const t1 = performance.now();
  await decryptFile(encPath, decPath, key);
  const decMs = performance.now() - t1;
  const decMBs = (bytes / (1024 * 1024)) / (decMs / 1000);

  console.log(`${name}: enc=${encMs.toFixed(0)}ms (${encMBs.toFixed(1)} MB/s), dec=${decMs.toFixed(0)}ms (${decMBs.toFixed(1)} MB/s)`);

  // Limpiar
  [inputPath, encPath, decPath].forEach(p => fs.unlinkSync(p));
}
```

## Plantilla de resultados

| Tamaño | Tiempo cifrado | Throughput cifrado | Tiempo descifrado | Throughput descifrado |
|--------|---------------|-------------------|------------------|----------------------|
| 1 MB | ms | MB/s | ms | MB/s |
| 10 MB | ms | MB/s | ms | MB/s |
| 100 MB | ms | MB/s | ms | MB/s |
| 1 GB | ms | MB/s | ms | MB/s |

**Nota**: Incluir el tiempo de derivación Argon2id (~Xms) en la columna de tiempo total para archivos.

## Verificar AES-NI

```bash
# En Linux/WSL:
grep -m1 'aes' /proc/cpuinfo

# En Node.js, AES-NI se usa automáticamente si el CPU lo soporta
# Diferencia esperada: 5-10x más rápido con AES-NI
```

## Criterio de éxito

- Throughput ≥ 100 MB/s con AES-NI habilitado
- Throughput ≥ 10 MB/s sin AES-NI (software)
- Sin corrupción de datos (hash SHA-256 del archivo original = hash del archivo descifrado)
