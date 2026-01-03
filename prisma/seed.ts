// prisma/seed.ts
import { PrismaClient } from 'generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create default roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full access',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Regular user',
    },
  });

  // Create default permissions
  const permissions = [
    { name: 'portfolio:read', description: 'View portfolio' },
    { name: 'portfolio:write', description: 'Modify portfolio' },
    { name: 'transactions:read', description: 'View transactions' },
    { name: 'transactions:write', description: 'Create/edit transactions' },
    { name: 'users:read', description: 'View users' },
    { name: 'users:write', description: 'Manage users' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { name: perm.name },
      update: {},
      create: perm,
    });
  }

  // Create popular brokers
  const brokers = [
    { name: 'Interactive Brokers', acronym: 'IBKR' },
    { name: 'Trading 212', acronym: 'T212' },
    { name: 'DEGIRO', acronym: 'DEGIRO' },
    { name: 'eToro', acronym: 'ETORO' },
    { name: 'XTB', acronym: 'XTB' },
    { name: 'Revolut', acronym: 'REV' },
  ];

  for (const broker of brokers) {
    await prisma.broker.upsert({
      where: { publicId: broker.acronym.toLowerCase() },
      update: {},
      create: {
        name: broker.name,
        acronym: broker.acronym,
      },
    });
  }

  // Create common sectors
  const sectors = [
    'Technology',
    'Healthcare',
    'Financial Services',
    'Consumer Cyclical',
    'Consumer Defensive',
    'Industrials',
    'Energy',
    'Utilities',
    'Real Estate',
    'Basic Materials',
    'Communication Services',
  ];

  for (const sectorName of sectors) {
    await prisma.sector.upsert({
      where: { id: sectors.indexOf(sectorName) + 1 },
      update: {},
      create: { name: sectorName },
    });
  }

  // Create common benchmarks
  const benchmarks = [
    { name: 'S&P 500', symbol: '^GSPC', currency: 'USD' },
    { name: 'NASDAQ Composite', symbol: '^IXIC', currency: 'USD' },
    { name: 'Dow Jones Industrial Average', symbol: '^DJI', currency: 'USD' },
    { name: 'FTSE 100', symbol: '^FTSE', currency: 'GBP' },
    { name: 'DAX', symbol: '^GDAXI', currency: 'EUR' },
    { name: 'Euro Stoxx 50', symbol: '^STOXX50E', currency: 'EUR' },
  ];

  for (const benchmark of benchmarks) {
    await prisma.benchmark.upsert({
      where: { publicId: benchmark.symbol },
      update: {},
      create: benchmark,
    });
  }

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
