const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  const staffPasswordHash = await bcrypt.hash("Staff@123", 10);
  const supervisorPasswordHash = await bcrypt.hash("Supervisor@123", 10);

  const admin = prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@example.com",
      passwordHash,
      role: "admin",
    },
  });

  const staff = prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      name: "Cleaning Staff",
      email: "staff@example.com",
      passwordHash: staffPasswordHash,
      role: "staff",
    },
  });

  const supervisor = prisma.user.upsert({
    where: { email: "supervisor@example.com" },
    update: {},
    create: {
      name: "Shift Supervisor",
      email: "supervisor@example.com",
      passwordHash: supervisorPasswordHash,
      role: "supervisor",
    },
  });

  await Promise.all([admin, staff, supervisor]);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
