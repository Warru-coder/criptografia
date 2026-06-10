import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { encryptFile } from '../../crypto/fileCipher';
import { decryptFile } from '../../crypto/fileDecipher';
import { getMasterKeyLegacy as getMasterKey, verifyMasterPasswordLegacy as verifyMasterPassword, isVaultInitializedLegacy as isVaultInitialized } from '../../passwordManager/secureStorage';
import { getOutputPath } from '../../filesystem/fileScanner';
import { createProgressBar } from '../progressBar';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

export async function batchCommand(options: {
  input: string[];
  action: 'encrypt' | 'decrypt';
  output?: string;
  verbose?: boolean;
}): Promise<void> {
  if (!isVaultInitialized()) {
    console.error('Error: Vault not initialized. Run "securecrypt init" first.');
    process.exit(1);
  }

  const files = options.input.map((p) => path.resolve(p));

  for (const filePath of files) {
    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      process.exit(1);
    }
  }

  const password = await prompt('Enter master password: ');

  const isValid = await verifyMasterPassword(password);
  if (!isValid) {
    console.error('Error: Invalid password.');
    rl.close();
    process.exit(1);
  }

  const masterKey = await getMasterKey(password);
  const outputDir = options.output ? path.resolve(options.output) : null;

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  const progressBar = createProgressBar();
  progressBar.start(files.length, 0);

  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const isEncrypting = options.action === 'encrypt';

    const outputPath = outputDir
      ? path.join(outputDir, isEncrypting ? path.basename(filePath) + '.scrypt' : path.basename(filePath).replace('.scrypt', ''))
      : getOutputPath(filePath, null, isEncrypting);

    try {
      if (isEncrypting) {
        await encryptFile(filePath, outputPath, masterKey);
      } else {
        await decryptFile(filePath, outputPath, masterKey);
      }

      processed++;
      if (options.verbose) {
        console.log(`  ${isEncrypting ? 'Encrypted' : 'Decrypted'}: ${path.basename(filePath)}`);
      }
    } catch (error) {
      failed++;
      errors.push(`Failed ${options.action} ${filePath}: ${(error as Error).message}`);
    }

    progressBar.update(i + 1);
  }

  progressBar.stop();

  console.log(`\nBatch ${options.action} complete:`);
  console.log(`  Processed: ${processed}`);
  console.log(`  Failed: ${failed}`);

  if (errors.length > 0) {
    console.error('\nErrors:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
  }

  rl.close();
}

