const bcrypt = require("bcryptjs");
const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const {
  stationSchema,
  userSchema,
  shiftSchema,
  templateSchema,
} = require("../validators/adminValidator");

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id parameter.");
  }
  return id;
}

function validate(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "Validation failed.", parsed.error.flatten());
  }
  return parsed.data;
}

async function listStations(req, res, next) {
  try {
    const stations = await prisma.station.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: stations });
  } catch (error) {
    next(error);
  }
}

async function createStation(req, res, next) {
  try {
    const data = validate(stationSchema, req.body);
    const created = await prisma.station.create({ data });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === "P2002") return next(new ApiError(409, "Station code already exists."));
    next(error);
  }
}

async function updateStation(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const data = validate(stationSchema.partial(), req.body);
    const updated = await prisma.station.update({ where: { id }, data });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "Station not found."));
    if (error.code === "P2002") return next(new ApiError(409, "Station code already exists."));
    next(error);
  }
}

async function deleteStation(req, res, next) {
  try {
    const id = parseId(req.params.id);
    await prisma.station.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Station deleted." });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "Station not found."));
    next(error);
  }
}

async function listUsers(req, res, next) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const payload = validate(userSchema, req.body);
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const created = await prisma.user.create({
      data: {
        name: payload.name,
        email: payload.email,
        passwordHash,
        role: payload.role,
        isActive: payload.isActive ?? true,
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === "P2002") return next(new ApiError(409, "User email already exists."));
    next(error);
  }
}

async function updateUser(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const schema = userSchema.partial().extend({
      password: userSchema.shape.password.optional(),
    });
    const payload = validate(schema, req.body);
    const data = { ...payload };
    if (payload.password) data.passwordHash = await bcrypt.hash(payload.password, 10);
    delete data.password;

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "User not found."));
    if (error.code === "P2002") return next(new ApiError(409, "User email already exists."));
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const id = parseId(req.params.id);
    await prisma.user.delete({ where: { id } });
    res.status(200).json({ success: true, message: "User deleted." });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "User not found."));
    next(error);
  }
}

async function listShifts(req, res, next) {
  try {
    const shifts = await prisma.shift.findMany({
      include: {
        station: { select: { id: true, name: true, code: true } },
        assignments: {
          include: { user: { select: { id: true, name: true, role: true, email: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: shifts });
  } catch (error) {
    next(error);
  }
}

async function createShift(req, res, next) {
  try {
    const payload = validate(shiftSchema, req.body);

    const created = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.create({
        data: {
          stationId: payload.stationId,
          name: payload.name,
          startTime: payload.startTime,
          endTime: payload.endTime,
          timezone: payload.timezone ?? "Asia/Kolkata",
          isActive: payload.isActive ?? true,
        },
      });

      const assignmentDate = new Date(payload.assignmentDate);
      const assignments = [
        ...payload.assignedStaffIds.map((userId) => ({
          shiftId: shift.id,
          userId,
          assignmentRole: "staff",
          assignmentDate,
        })),
        ...payload.assignedSupervisorIds.map((userId) => ({
          shiftId: shift.id,
          userId,
          assignmentRole: "supervisor",
          assignmentDate,
        })),
      ];

      if (assignments.length > 0) {
        await tx.shiftAssignment.createMany({
          data: assignments,
          skipDuplicates: true,
        });
      }

      return tx.shift.findUnique({
        where: { id: shift.id },
        include: {
          station: { select: { id: true, name: true, code: true } },
          assignments: {
            include: { user: { select: { id: true, name: true, role: true, email: true } } },
          },
        },
      });
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === "P2003") return next(new ApiError(400, "Invalid station or user reference."));
    next(error);
  }
}

async function updateShift(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const payload = validate(shiftSchema.partial(), req.body);
    const updated = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.update({
        where: { id },
        data: {
          stationId: payload.stationId,
          name: payload.name,
          startTime: payload.startTime,
          endTime: payload.endTime,
          timezone: payload.timezone,
          isActive: payload.isActive,
        },
      });

      if (
        payload.assignmentDate ||
        payload.assignedStaffIds ||
        payload.assignedSupervisorIds
      ) {
        await tx.shiftAssignment.deleteMany({ where: { shiftId: id } });
        const assignmentDate = payload.assignmentDate
          ? new Date(payload.assignmentDate)
          : new Date();
        const assignments = [
          ...((payload.assignedStaffIds || []).map((userId) => ({
            shiftId: id,
            userId,
            assignmentRole: "staff",
            assignmentDate,
          }))),
          ...((payload.assignedSupervisorIds || []).map((userId) => ({
            shiftId: id,
            userId,
            assignmentRole: "supervisor",
            assignmentDate,
          }))),
        ];

        if (assignments.length > 0) {
          await tx.shiftAssignment.createMany({ data: assignments, skipDuplicates: true });
        }
      }

      return tx.shift.findUnique({
        where: { id: shift.id },
        include: {
          station: { select: { id: true, name: true, code: true } },
          assignments: {
            include: { user: { select: { id: true, name: true, role: true, email: true } } },
          },
        },
      });
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "Shift not found."));
    if (error.code === "P2003") return next(new ApiError(400, "Invalid station or user reference."));
    next(error);
  }
}

async function deleteShift(req, res, next) {
  try {
    const id = parseId(req.params.id);
    await prisma.shift.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Shift deleted." });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "Shift not found."));
    next(error);
  }
}

async function listTemplates(req, res, next) {
  try {
    const templates = await prisma.checklistTemplate.findMany({
      include: {
        station: { select: { id: true, name: true, code: true } },
        items: { orderBy: { displayOrder: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: templates });
  } catch (error) {
    next(error);
  }
}

async function createTemplate(req, res, next) {
  try {
    const payload = validate(templateSchema, req.body);
    const created = await prisma.checklistTemplate.create({
      data: {
        stationId: payload.stationId,
        title: payload.title,
        version: payload.version ?? 1,
        isActive: payload.isActive ?? true,
        items: {
          create: payload.items.map((item) => ({
            label: item.label,
            isMandatory: item.isMandatory ?? false,
            displayOrder: item.displayOrder,
            inputType: item.inputType ?? "boolean",
          })),
        },
      },
      include: { items: { orderBy: { displayOrder: "asc" } } },
    });
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === "P2003") return next(new ApiError(400, "Invalid station reference."));
    next(error);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const payload = validate(templateSchema.partial(), req.body);
    const updated = await prisma.$transaction(async (tx) => {
      await tx.checklistTemplate.update({
        where: { id },
        data: {
          stationId: payload.stationId,
          title: payload.title,
          version: payload.version,
          isActive: payload.isActive,
        },
      });

      if (payload.items) {
        await tx.checklistTemplateItem.deleteMany({ where: { templateId: id } });
        await tx.checklistTemplateItem.createMany({
          data: payload.items.map((item) => ({
            templateId: id,
            label: item.label,
            isMandatory: item.isMandatory ?? false,
            displayOrder: item.displayOrder,
            inputType: item.inputType ?? "boolean",
          })),
        });
      }

      return tx.checklistTemplate.findUnique({
        where: { id },
        include: {
          station: { select: { id: true, name: true, code: true } },
          items: { orderBy: { displayOrder: "asc" } },
        },
      });
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "Template not found."));
    if (error.code === "P2003") return next(new ApiError(400, "Invalid station reference."));
    next(error);
  }
}

async function deleteTemplate(req, res, next) {
  try {
    const id = parseId(req.params.id);
    await prisma.checklistTemplate.delete({ where: { id } });
    res.status(200).json({ success: true, message: "Template deleted." });
  } catch (error) {
    if (error.code === "P2025") return next(new ApiError(404, "Template not found."));
    next(error);
  }
}

async function checklistReport(req, res, next) {
  try {
    const where = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.shiftId) where.shiftId = parseId(req.query.shiftId);
    if (req.query.stationId) where.stationId = parseId(req.query.stationId);

    const submissions = await prisma.checklistSubmission.findMany({
      where,
      include: {
        station: { select: { id: true, name: true, code: true } },
        shift: { select: { id: true, name: true, startTime: true, endTime: true } },
        staff: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const statusSummary = submissions.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      { draft: 0, submitted: 0, approved: 0, rejected: 0 }
    );

    res.status(200).json({
      success: true,
      data: {
        total: submissions.length,
        statusSummary,
        submissions,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listStations,
  createStation,
  updateStation,
  deleteStation,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  listShifts,
  createShift,
  updateShift,
  deleteShift,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  checklistReport,
};
