import { PrismaClient } from '@prisma/client';
import { config } from './environment';

// Create Prisma client instance
export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.databaseUrl,
    },
  },
  log:
    config.nodeEnv === 'development'
      ? ['query', 'info', 'warn', 'error']
      : ['error'],
});

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

export default prisma;
