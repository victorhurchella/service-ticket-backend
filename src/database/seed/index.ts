import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const users = [
    {
      email: 'associate@example.com',
      password: 'Password123!',
      role: Role.ASSOCIATE,
    },
    {
      email: 'manager@example.com',
      password: 'Password123!',
      role: Role.MANAGER,
    },
  ];

  for (const u of users) {
    const passwordHash = await hash(u.password, 10);

    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role },
      create: { email: u.email, passwordHash, role: u.role },
    });

    console.log(`✅ User seeded: ${u.email} (${u.role})`);
  }

  const now = new Date();
  const year = now.getUTCFullYear();

  await prisma.ticketSequence.upsert({
    where: { year },
    update: {},
    create: { year, lastValue: 0 },
  });

  console.log(`✅ Ticket sequence initialized for year ${year}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
