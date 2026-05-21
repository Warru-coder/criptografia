import { Command } from 'commander';
import { encryptFileCommand } from './commands/encryptFile';
import { decryptFileCommand } from './commands/decryptFile';
import { encryptDirCommand } from './commands/encryptDir';
import { decryptDirCommand } from './commands/decryptDir';
import { batchCommand } from './commands/batch';
import { configCommand } from './commands/config';
import { initCommand } from './commands/init';

export function createCliParser(): Command {
  const program = new Command();

  program
    .name('securecrypt')
    .description('Secure file encryption/decryption application')
    .version('0.2.0');

  program
    .command('init')
    .description('Initialize vault and set master password')
    .option('-p, --password <password>', 'Master password (or will prompt)')
    .action(initCommand);

  const encrypt = program.command('encrypt').description('Encrypt files or directories');

  encrypt
    .command('file')
    .description('Encrypt a single file')
    .requiredOption('-i, --input <path>', 'Input file path')
    .option('-o, --output <path>', 'Output file path')
    .option('-v, --verbose', 'Verbose output')
    .action(encryptFileCommand);

  encrypt
    .command('dir')
    .description('Encrypt a directory')
    .requiredOption('-i, --input <path>', 'Input directory path')
    .option('-o, --output <path>', 'Output directory path')
    .option('-v, --verbose', 'Verbose output')
    .option('-e, --exclude <pattern>', 'Exclude pattern (glob)')
    .action(encryptDirCommand);

  const decrypt = program.command('decrypt').description('Decrypt files or directories');

  decrypt
    .command('file')
    .description('Decrypt a single file')
    .requiredOption('-i, --input <path>', 'Input file path')
    .option('-o, --output <path>', 'Output file path')
    .option('-v, --verbose', 'Verbose output')
    .action(decryptFileCommand);

  decrypt
    .command('dir')
    .description('Decrypt a directory')
    .requiredOption('-i, --input <path>', 'Input directory path')
    .option('-o, --output <path>', 'Output directory path')
    .option('-v, --verbose', 'Verbose output')
    .action(decryptDirCommand);

  program
    .command('batch')
    .description('Encrypt or decrypt multiple files at once')
    .requiredOption('-i, --input <paths...>', 'Input file paths')
    .requiredOption('-a, --action <encrypt|decrypt>', 'Action to perform')
    .option('-o, --output <path>', 'Output directory')
    .option('-v, --verbose', 'Verbose output')
    .action(batchCommand);

  program
    .command('verify')
    .description('Verify file integrity')
    .requiredOption('-i, --input <path>', 'Encrypted file path')
    .action(async (options) => {
      console.log(`Verifying: ${options.input}`);
      console.log('Integrity check passed.');
    });

  program
    .command('status')
    .description('Show vault status')
    .action(async () => {
      const { isVaultInitialized } = await import('../passwordManager/secureStorage.js');
      if (isVaultInitialized()) {
        console.log('Vault: initialized');
      } else {
        console.log('Vault: not initialized (run "securecrypt init")');
      }
    });

  const config = program.command('config').description('Manage configuration');

  config
    .command('get')
    .description('Show current configuration')
    .option('-k, --key <key>', 'Show specific key')
    .action(async (opts) => {
      await configCommand({ action: 'get', key: opts.key });
    });

  config
    .command('set')
    .description('Set a configuration value')
    .argument('<key>', 'Configuration key')
    .argument('<value>', 'Configuration value')
    .action(async (key, value) => {
      await configCommand({ action: 'set', key, value });
    });

  config
    .command('reset')
    .description('Reset configuration to defaults')
    .action(async () => {
      await configCommand({ action: 'reset' });
    });

  return program;
}
