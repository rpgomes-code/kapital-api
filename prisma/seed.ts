// prisma/seed.ts
import {
  PrismaClient
} from 'generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administrator' },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: { name: 'user', description: 'Standard User' },
  });

  // Seed permissions
  const permissions = [
    'portfolio:read',
    'portfolio:write',
    'transactions:read',
    'transactions:write',
    'admin:users',
  ];

  for (const name of permissions) {
    await prisma.permission.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // Seed common brokers
  const brokers = [
    { acronym: 'IBKR', name: 'Interactive Brokers' },
    { acronym: 'TD', name: 'TD Ameritrade' },
    { acronym: 'DEGIRO', name: 'DEGIRO' },
    { acronym: 'T212', name: 'Trading 212' },
    { acronym: 'XTB', name: 'XTB' },
  ];

  for (const broker of brokers) {
    await prisma.broker.upsert({
      where: { name: broker.name },
      update: {},
      create: broker,
    });
  }

  // Seed common benchmarks
  const benchmarks = [
    { name: 'S&P 500', symbol: '^GSPC', currency: 'USD' },
    { name: 'NASDAQ', symbol: '^IXIC', currency: 'USD' },
    { name: 'FTSE 100', symbol: '^FTSE', currency: 'GBP' },
    { name: 'DAX', symbol: '^GDAXI', currency: 'EUR' },
  ];

  for (const benchmark of benchmarks) {
    await prisma.benchmark.upsert({
      where: { symbol: benchmark.symbol },
      update: {},
      create: benchmark,
    });
  }

  // Create a test user
  await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      username: 'testuser',
      name: 'Test User',
      mainCurrency: 'USD',
      roleId: userRole.id,
    },
  });

  console.log('✅ Seed completed');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
