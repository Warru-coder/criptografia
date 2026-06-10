import { auditConfig, type CryptoConfig } from '../../src/ai/services/configAuditor';

async function main() {
const cases: Array<{ label: string; config: CryptoConfig; expectedIds: string[] }> = [
  { label: 'S01 secure default', expectedIds: [], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 32 } },
  { label: 'S02 secure min',     expectedIds: [], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 19456, timeCost: 2, parallelism: 1 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 16 } },
  { label: 'V01 AES-128-CBC',    expectedIds: ['ALG-001'], config: { algorithm: 'AES-128-CBC', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 12 } },
  { label: 'V03 PBKDF2 10k',     expectedIds: ['KDF-001', 'KDF-004'], config: { algorithm: 'AES-256-GCM', kdf: 'pbkdf2', kdfParams: { iterations: 10000 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 32 } },
  { label: 'V05 lowmem',         expectedIds: ['KDF-002'], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 4096, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 32 } },
  { label: 'V06 timeCost 1',     expectedIds: ['KDF-003'], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 1, parallelism: 2 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 32 } },
  { label: 'V07 key16',          expectedIds: ['KEY-001'], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 16, ivLength: 12, tagLength: 16, saltLength: 32 } },
  { label: 'V08 iv8',            expectedIds: ['IV-001'], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 8, tagLength: 16, saltLength: 32 } },
  { label: 'V09 tag12',          expectedIds: ['TAG-001'], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 12, tagLength: 12, saltLength: 32 } },
  { label: 'V10 salt8',          expectedIds: ['SALT-001'], config: { algorithm: 'AES-256-GCM', kdf: 'argon2id', kdfParams: { memoryCost: 65536, timeCost: 3, parallelism: 2 }, keyLength: 32, ivLength: 12, tagLength: 16, saltLength: 8 } },
];

let tp = 0, fp = 0, fn = 0;
for (const tc of cases) {
  const r = await auditConfig(tc.config);
  const found = r.findings.map(f => f.id);
  for (const id of tc.expectedIds) { found.includes(id) ? tp++ : fn++; }
  for (const id of found) { if (!tc.expectedIds.includes(id)) fp++; }
  console.log(`${tc.label}: found=[${found.join(',')}] score=${r.score} risk=${r.riskLevel}`);
}
const prec = tp/(tp+fp), rec = tp/(tp+fn);
console.log(`\nTP=${tp} FP=${fp} FN=${fn}`);
console.log(`Precision=${(prec*100).toFixed(1)}%  Recall=${(rec*100).toFixed(1)}%  F1=${(2*prec*rec/(prec+rec)).toFixed(3)}`);
}
main().catch(console.error);
