import * as readline from 'readline';
import { setupMasterPasswordLegacy as setupMasterPassword, isVaultInitializedLegacy as isVaultInitialized } from '../../passwordManager/secureStorage';
import { validatePassword, getPasswordStrength } from '../../passwordManager/passwordValidator';
import { ensureAppDataDirs } from '../../config';

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

export async function initCommand(options: { password?: string }): Promise<void> {
  if (isVaultInitialized()) {
    console.error('Error: Vault is already initialized.');
    process.exit(1);
  }

  ensureAppDataDirs();

  let password: string;

  if (options.password) {
    password = options.password;
  } else {
    password = await prompt('Enter master password: ');
    const confirm = await prompt('Confirm master password: ');

    if (password !== confirm) {
      console.error('Error: Passwords do not match.');
      rl.close();
      process.exit(1);
    }
  }

  const validation = validatePassword(password);

  if (!validation.isValid) {
    console.error('Password does not meet requirements:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    rl.close();
    process.exit(1);
  }

  console.log(`Password strength: ${getPasswordStrength(validation.score)}`);

  try {
    await setupMasterPassword(password);
    console.log('Vault created successfully at Desktop/AppSecureData/');
  } catch (error) {
    console.error(`Failed to create vault: ${(error as Error).message}`);
    process.exit(1);
  }

  rl.close();
}
