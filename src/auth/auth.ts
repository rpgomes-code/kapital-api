import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Create Prisma client with PostgreSQL adapter (required for Prisma v7)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
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
  // Configure ID generation to use serial for user (existing schema uses autoincrement)
  // but UUID for other auth tables
  advanced: {
    database: {
      generateId: (options) => {
        // Let database handle User IDs (autoincrement)
        if (options.model === 'user') {
          return false;
        }
        // Use UUID for other models (session, account, verification)
        return crypto.randomUUID();
      },
    },
  },
  user: {
    modelName: 'users', // Maps to our @@map("users")
    fields: {
      emailVerified: 'email_verified',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
    additionalFields: {
      publicId: {
        type: 'string',
        required: false,
        input: false, // Not provided by user, auto-generated
      },
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
        fieldName: 'main_currency',
        defaultValue: 'USD',
      },
    },
  },
  session: {
    modelName: 'sessions',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      ipAddress: 'ip_address',
      userAgent: 'user_agent',
      userId: 'user_id',
    },
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // Update session every 24 hours
  },
  account: {
    modelName: 'auth_accounts',
    fields: {
      accountId: 'account_id',
      providerId: 'provider_id',
      userId: 'user_id',
      accessToken: 'access_token',
      refreshToken: 'refresh_token',
      idToken: 'id_token',
      accessTokenExpiresAt: 'access_token_expires_at',
      refreshTokenExpiresAt: 'refresh_token_expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  verification: {
    modelName: 'verifications',
    fields: {
      expiresAt: 'expires_at',
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
});

export type Auth = typeof auth;
