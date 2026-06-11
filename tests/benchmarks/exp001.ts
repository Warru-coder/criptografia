import argon2 from 'argon2';

const PASSWORD = 'TestPassword123!';
const SALT = Buffer.alloc(32, 0xab);
const RUNS = 5;

interface Config {
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

const configs: Config[] = [
  { memoryCost: 19456,  timeCost: 2, parallelism: 1 },
  { memoryCost: 19456,  timeCost: 3, parallelism: 2 },
  { memoryCost: 65536,  timeCost: 2, parallelism: 1 },
  { memoryCost: 65536,  timeCost: 3, parallelism: 2 },
  { memoryCost: 131072, timeCost: 3, parallelism: 2 },
];

async function measure(cfg: Config): Promise<number[]> {
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    await argon2.hash(PASSWORD, {
      type: argon2.argon2id,
      salt: SALT,
      memoryCost: cfg.memoryCost,
      timeCost: cfg.timeCost,
      parallelism: cfg.parallelism,
      hashLength: 32,
      raw: true,
    });
    times.push(performance.now() - t0);
  }
  return times;
}

function stats(times: number[]) {
  const sorted = [...times].sort((a, b) => a - b);
  const avg = times.reduce((s, v) => s + v, 0) / times.length;
  const variance = times.reduce((s, v) => s + (v - avg) ** 2, 0) / times.length;
  return {
    avg: +avg.toFixed(1),
    std: +Math.sqrt(variance).toFixed(1),
    min: +sorted[0].toFixed(1),
    max: +sorted[sorted.length - 1].toFixed(1),
  };
}

async function main() {
  console.log('EXP-001: Argon2id KDF benchmark');
  console.log(`Runs per config: ${RUNS} | Password: "${PASSWORD}"`);
  console.log('');
  console.log('memoryCost\ttimeCost\tparallelism\tavg_ms\tstd_ms\tmin_ms\tmax_ms');

  for (const cfg of configs) {
    // Warm-up
    await argon2.hash(PASSWORD, { type: argon2.argon2id, salt: SALT,
      memoryCost: cfg.memoryCost, timeCost: cfg.timeCost,
      parallelism: cfg.parallelism, hashLength: 32, raw: true });

    const times = await measure(cfg);
    const s = stats(times);
    console.log(`${cfg.memoryCost}\t\t${cfg.timeCost}\t\t${cfg.parallelism}\t\t${s.avg}\t${s.std}\t${s.min}\t${s.max}`);
  }
}

main().catch(console.error);
