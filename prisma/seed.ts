import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });

async function main() {
  const roles = [
    {
      name: 'USER',
      description: 'Standard application user',
    },
    {
      name: 'DEVELOPER',
      description: 'Developer with API access',
    },
    {
      name: 'ADMIN',
      description: 'Administrator with elevated permissions',
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: {
        name: role.name,
      },

      update: {
        description: role.description,
      },

      create: role,
    });
  }

  console.log('Default roles seeded successfully');
}

main()
  .catch((error) => {
    console.error('Role seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
