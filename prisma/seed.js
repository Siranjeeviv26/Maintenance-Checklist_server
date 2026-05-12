const bcrypt = require("bcryptjs");
const prisma = require("../src/config/prisma");

async function main() {
  const passwordHash = await bcrypt.hash("Admin@123", 10);
  const staffPasswordHash = await bcrypt.hash("Staff@123", 10);
  const supervisorPasswordHash = await bcrypt.hash("Supervisor@123", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "System Admin",
      email: "admin@example.com",
      passwordHash,
      role: "admin",
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: "staff@example.com" },
    update: {},
    create: {
      name: "Cleaning Staff",
      email: "staff@example.com",
      passwordHash: staffPasswordHash,
      role: "staff",
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: "supervisor@example.com" },
    update: {},
    create: {
      name: "Shift Supervisor",
      email: "supervisor@example.com",
      passwordHash: supervisorPasswordHash,
      role: "supervisor",
    },
  });

  const station = await prisma.station.upsert({
    where: { code: "STN-001" },
    update: {},
    create: {
      name: "Main Station",
      code: "STN-001",
      description: "Demo station for maintenance checklist workflows.",
    },
  });

  const today = new Date();
  const assignmentDate = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  const shiftName = `Demo Shift ${assignmentDate.toISOString().slice(0, 10)}`;
  const shift =
    (await prisma.shift.findFirst({
      where: {
        stationId: station.id,
        name: shiftName,
      },
    })) ||
    (await prisma.shift.create({
      data: {
        stationId: station.id,
        name: shiftName,
        startTime: "09:00",
        endTime: "17:00",
        timezone: "Asia/Kolkata",
      },
    }));

  await prisma.shiftAssignment.createMany({
    data: [
      {
        shiftId: shift.id,
        userId: staff.id,
        assignmentRole: "staff",
        assignmentDate,
      },
      {
        shiftId: shift.id,
        userId: supervisor.id,
        assignmentRole: "supervisor",
        assignmentDate,
      },
    ],
    skipDuplicates: true,
  });

  const existingTemplate = await prisma.checklistTemplate.findFirst({
    where: { stationId: station.id, title: "Daily Cleaning Checklist" },
  });

  if (!existingTemplate) {
    await prisma.checklistTemplate.create({
      data: {
        stationId: station.id,
        title: "Daily Cleaning Checklist",
        version: 1,
        items: {
          create: [
            {
              label: "Clean floor",
              isMandatory: true,
              displayOrder: 0,
              inputType: "boolean",
            },
            {
              label: "Check bins",
              isMandatory: true,
              displayOrder: 1,
              inputType: "boolean",
            },
            {
              label: "Report maintenance issue",
              isMandatory: false,
              displayOrder: 2,
              inputType: "text",
            },
          ],
        },
      },
    });
  }
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
