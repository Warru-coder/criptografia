# EXP-001: Benchmark Argon2id — Tiempo de derivación vs. parámetros

**Estado**: Pendiente de ejecución  
**Capítulo relacionado**: 8.2

## Objetivo

Medir el tiempo de derivación de claves con diferentes combinaciones de parámetros Argon2id para justificar la elección de (memoryCost=65536, timeCost=3, parallelism=2) como configuración por defecto de SecureCrypt.

## Protocolo

### Preparación

```bash
cd C:\Users\Gabriel\Desktop\criptografia
npm test -- --testPathPattern=argon2-benchmark
```

O usando el script de benchmark manual:

```typescript
// tests/benchmarks/argon2Benchmark.ts
import argon2 from 'argon2';

const configs = [
  { memoryCost: 19456, timeCost: 2, parallelism: 1 },
  { memoryCost: 19456, timeCost: 3, parallelism: 2 },
  { memoryCost: 65536, timeCost: 2, parallelism: 1 },
  { memoryCost: 65536, timeCost: 3, parallelism: 2 }, // SecureCrypt default
  { memoryCost: 131072, timeCost: 3, parallelism: 2 },
];

const PASSWORD = 'TestPassword123!';
const ITERATIONS = 5;

for (const config of configs) {
  const times: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();
    await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      ...config,
      hashLength: 32,
    });
    times.push(performance.now() - start);
  }
  const avg = times.reduce((a, b) => a + b) / times.length;
  const std = Math.sqrt(times.map(t => (t - avg) ** 2).reduce((a, b) => a + b) / times.length);
  console.log(`${JSON.stringify(config)} → avg=${avg.toFixed(1)}ms, std=${std.toFixed(1)}ms`);
}
```

### Ejecución

Ejecutar en el mismo hardware que el servidor de producción. Registrar temperatura CPU antes y después. Ejecutar 3 veces completas y tomar la mediana.

## Plantilla de resultados

| memoryCost (KB) | timeCost | parallelism | Promedio (ms) | Desv. típica (ms) | Mín (ms) | Máx (ms) |
|----------------|---------|------------|--------------|------------------|---------|---------|
| 19.456 | 2 | 1 | | | | |
| 19.456 | 3 | 2 | | | | |
| 65.536 | 2 | 1 | | | | |
| 65.536 | 3 | 2 | | | | |
| 131.072 | 3 | 2 | | | | |

## Criterio de éxito

La configuración por defecto (65536, 3, 2) debe tener un tiempo de derivación entre 100ms y 1000ms en el hardware objetivo. Dentro de este rango:
- < 100ms: demasiado rápido, aumentar parámetros
- 100–500ms: bueno para aplicación interactiva
- 500ms–1s: aceptable, en el límite de la UX
- > 1s: reducir parámetros o advertir al usuario

## Análisis de resistencia a ataques GPU

Con los parámetros actuales (65536 KB, timeCost=3), un atacante con una GPU RTX 4090 puede intentar aproximadamente:

- **PBKDF2-SHA256 (600k iter)**: ~10.000 hashes/s por GPU
- **Argon2id (65536 KB, t=3)**: ~2-5 hashes/s por GPU (requiere 64MB de VRAM por instancia)

La diferencia de ~2000-5000x hace que Argon2id sea sustancialmente más resistente a ataques de fuerza bruta acelerados por GPU.
