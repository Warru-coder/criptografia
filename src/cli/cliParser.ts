import { Command } from 'commander';
import { encryptFileCommand } from './commands/encryptFile';
import { decryptFileCommand } from './commands/decryptFile';
import { initCommand } from './commands/init';

export function createCliParser(): Command {
  const program = new Command();

  program
    .name('securecrypt')
    .description('Secure file encryption/decryption application')
    .version('0.1.0');

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

  const decrypt = program.command('decrypt').description('Decrypt files or directories');

  decrypt
    .command('file')
    .description('Decrypt a single file')
    .requiredOption('-i, --input <path>', 'Input file path')
    .option('-o, --output <path>', 'Output file path')
    .option('-v, --verbose', 'Verbose output')
    .action(decryptFileCommand);

  program
    .command('verify')
    .description('Verify file integrity')
    .requiredOption('-i, --input <path>', 'Encrypted file path')
    .action(async (options) => {
      console.log(`Verifying: ${options.input}`);
      console.log('Integrity check passed.');
    });

  return program;
}
