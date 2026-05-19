require('dotenv').config();

const connectDB = require('../config/db');
const { connectPrisma, disconnectPrisma, isPrismaEnabled } = require('../config/prisma');
const User = require('../models/User');
const SqlUserService = require('../services/SqlUserService');

async function syncUsers() {
  if (!isPrismaEnabled()) {
    throw new Error('DATABASE_URL is required to sync users to PostgreSQL');
  }

  await connectDB();
  await connectPrisma();

  let synced = 0;
  const cursor = User.find({}).cursor();

  for await (const user of cursor) {
    await SqlUserService.upsertFromMongoUser(user);
    synced += 1;
  }

  console.log(`Synced ${synced} users to PostgreSQL`);
}

syncUsers()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
    process.exit();
  });
