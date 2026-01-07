import 'dotenv/config'; // Ensure env vars are loaded before module initialization
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create Prisma client with PostgreSQL adapter (required for Prisma v7)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  basePath: '/api/auth', // Required for nestjs-better-auth
  trustedOrigins: process.env.TRUSTED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
  ],
  // Prisma handles column mapping via @@map directives, so no field mappings needed
  user: {
    modelName: 'user', // Prisma model accessor name (prisma.user)
    additionalFields: {
      username: {
        type: 'string',
        required: false,
      },
      country: {
        type: 'string',
        required: false,
      },
      mainCurrency: {
        type: 'string',
        required: false,
        defaultValue: 'USD',
      },
    },
  },
  session: {
    modelName: 'session', // Prisma model accessor name (prisma.session)
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  account: {
    modelName: 'authAccount', // Prisma model accessor name (prisma.authAccount)
  },
  verification: {
    modelName: 'verification', // Prisma model accessor name (prisma.verification)
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
});

export type Auth = typeof auth;
