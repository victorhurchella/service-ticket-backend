import { exec } from 'child_process';
import 'dotenv/config';
import { promisify } from 'util';

export default async function globalTeardown() {
  const asyncExec = promisify(exec);
  await asyncExec('yarn prisma db push --force-reset');
  console.log('Database successfully reset.');
}
