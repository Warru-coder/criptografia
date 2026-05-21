import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { decryptDirectory, DirectoryProgress } from '../../filesystem/directoryProcessor';
import { getMasterKey, verifyMasterPassword, isVaultInitialized } from '../../passwordManager/secureStorage';
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

export async function decryptDirCommand(options: {
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
    console.error(`Error: Directory not found: ${inputPath}`);
    process.exit(1);
  }

  if (!fs.statSync(inputPath).isDirectory()) {
    console.error(`Error: Path is not a directory: ${inputPath}`);
    process.exit(1);
  }

  const outputPath = options.output
    ? path.resolve(options.output)
    : path.join(path.dirname(inputPath), path.basename(inputPath) + '.decrypted');

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
    progressBar.start(100, 0);

    const result = await decryptDirectory(
      inputPath,
      outputPath,
      masterKey,
      (progress: DirectoryProgress) => {
        progressBar.update(progress.overallPercentage);
      }
    );

    progressBar.stop();

    console.log(`Decrypted directory: ${inputPath} -> ${outputPath}`);
    console.log(`Files processed: ${result.processedFiles}`);

    if (result.failedFiles > 0) {
      console.error(`Failed files: ${result.failedFiles}`);
      for (const error of result.errors) {
        console.error(`  - ${error}`);
      }
    }

    if (options.verbose) {
      console.log(`Total size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
    }
  } catch (error) {
    console.error(`Directory decryption failed: ${(error as Error).message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}
