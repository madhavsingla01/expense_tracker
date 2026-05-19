let prisma;

const isPrismaEnabled = () => Boolean(process.env.DATABASE_URL);

const getPrisma = () => {
  if (!isPrismaEnabled()) return null;

  if (!prisma) {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
    });
  }

  return prisma;
};

const connectPrisma = async () => {
  if (!isPrismaEnabled()) {
    console.warn('PostgreSQL skipped: DATABASE_URL is not configured');
    return null;
  }

  const client = getPrisma();
  await client.$connect();
  console.log('PostgreSQL connected through Prisma');
  return client;
};

const disconnectPrisma = async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
};

module.exports = {
  connectPrisma,
  disconnectPrisma,
  getPrisma,
  isPrismaEnabled,
};
