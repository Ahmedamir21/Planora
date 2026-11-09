import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline';

// Read password from the terminal instead of shell arguments or command history.
const terminal = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
process.stdout.write('Password (minimum 12 characters; input hidden): ');
terminal._writeToOutput = () => {};
terminal.question('', (password) => {
  process.stdout.write('\n');
  terminal.close();
  if (password.length < 12) { console.error('Use at least 12 characters.'); process.exitCode = 1; return; }
  const salt = randomBytes(16);
  console.log(`PLANORA_ADMIN_PASSWORD_HASH=${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`);
  console.log(`PLANORA_ADMIN_SESSION_SECRET=${randomBytes(32).toString('hex')}`);
});
