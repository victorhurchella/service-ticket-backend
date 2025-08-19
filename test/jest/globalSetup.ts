import 'dotenv/config';

import { exec } from 'child_process';
import { promisify } from 'util';

export default async function globalSetup() {
  process.env.TZ = 'UTC';
  process.env.PORT = '4001';
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;

  process.env.JWT_SECRET = 'e2e-secret';
  process.env.JWT_EXPIRES_IN = '1d';
  process.env.CRON_SECRET = 'e2e-cron-secret';

  const execAsync = promisify(exec);

  console.log('\nRunning migrations...');
  await execAsync('yarn prisma migrate reset --force');

  console.log('\nRunning seed...');
  await execAsync('yarn seed');

  console.log('Test environment setup complete');
}
