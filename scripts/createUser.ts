import { createUser, findUserByUsername } from '../src/database/userRepository';
import { setupMasterPassword } from '../src/passwordManager/secureStorage';
import { deriveKeyForStorage } from '../src/crypto/cryptoUtils';
import { closeDb } from '../src/database/db';

const USERNAME = process.argv[2];
const PASSWORD = process.argv[3];

if (!USERNAME || !PASSWORD) {
  console.error('Uso: ts-node scripts/createUser.ts <usuario> <contraseña>');
  process.exit(1);
}

async function main() {
  if (findUserByUsername(USERNAME)) {
    console.log(`Usuario "${USERNAME}" ya existe.`);
    closeDb();
    return;
  }

  const { hash, salt } = await deriveKeyForStorage(PASSWORD);
  const user = createUser(USERNAME, hash, salt.toString('base64'));
  await setupMasterPassword(user.id, PASSWORD);

  console.log(`\nUsuario creado:`);
  console.log(`  Usuario: ${USERNAME}`);
  console.log(`  ID:      ${user.id}`);
  closeDb();
}

main().catch(e => { console.error(e); closeDb(); process.exit(1); });
