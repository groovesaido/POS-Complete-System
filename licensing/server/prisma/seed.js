/**
 * License Server Seed Script
 *
 * Usage:
 *   cd licensing/server
 *   npx prisma db push   # Push schema to PostgreSQL
 *   node prisma/seed.js   # Seed initial data (optional)
 */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("[Seed] License database is ready.");
  console.log("[Seed] Run `npx prisma db push` first if tables don't exist yet.");

  const count = await prisma.license.count();
  console.log(`[Seed] Existing licenses: ${count}`);
}

main()
  .catch((e) => {
    console.error("[Seed] Error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
