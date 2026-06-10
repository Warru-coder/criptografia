import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { encryptFile, EncryptProgress } from '../../crypto/fileCipher';
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

export async function encryptFileCommand(options: {
  input: string;
  output?: string;
  verbose?: boolean;
}): Promise<void> {
  if (!isVaultInitialized()) {
    console.error('Error: Vault not initialized. Run "securecrypt init" first.');
    process.exit(1);
  }

  const inputPath = path.resolve(options.input);

  if (!fs.existsSync(inputPath)) {
    console.error(`Error: File not found: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = options.output
    ? path.resolve(options.output)
    : getOutputPath(inputPath, null, true);

  const password = await prompt('Enter master password: ');

  const isValid = await verifyMasterPassword(password);
  if (!isValid) {
    console.error('Error: Invalid password.');
    rl.close();
    process.exit(1);
  }

  const masterKey = await getMasterKey(password);

  try {
    const progressBar = createProgressBar();
    const totalSize = fs.statSync(inputPath).size;

    progressBar.start(totalSize, 0);

    await encryptFile(inputPath, outputPath, masterKey, (progress: EncryptProgress) => {
      progressBar.update(progress.bytesProcessed);
    });

    progressBar.stop();

    console.log(`Encrypted: ${inputPath} -> ${outputPath}`);

    if (options.verbose) {
      console.log(`Original size: ${totalSize} bytes`);
      console.log(`Encrypted size: ${fs.statSync(outputPath).size} bytes`);
    }
  } catch (error) {
    console.error(`Encryption failed: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

