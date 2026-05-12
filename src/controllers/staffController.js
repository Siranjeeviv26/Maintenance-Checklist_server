const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { submitChecklistSchema } = require("../validators/staffValidator");
const { isShiftExpired } = require("../utils/shiftTime");

const APP_TIMEZONE = "Asia/Kolkata";

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id parameter.");
  }
  return id;
}

function dateKeyInTimezone(date, timeZone = APP_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function getMyShiftsToday(req, res, next) {
  try {
    const now = new Date();
    const todayKey = dateKeyInTimezone(now);
    const start = new Date(now);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setDate(end.getDate() + 1);
    end.setHours(23, 59, 59, 999);

    const assignments = await prisma.shiftAssignment.findMany({
      where: {
        userId: req.user.sub,
        assignmentRole: "staff",
        assignmentDate: {
          gte: start,
          lte: end,
        },
      },
      include: {
        shift: {
          include: {
            station: true,
          },
        },
      },
      orderBy: { assignmentDate: "asc" },
    });

    const todayAssignments = assignments.filter(
      (assignment) => dateKeyInTimezone(assignment.assignmentDate) === todayKey
    );

    const enrichedAssignments = await Promise.all(
      todayAssignments.map(async (assignment) => {
        const submission = await prisma.checklistSubmission.findFirst({
          where: {
            shiftId: assignment.shiftId,
            staffId: req.user.sub,
            submissionDate: assignment.assignmentDate,
          },
          select: { id: true, status: true, submittedAt: true },
        });
        return {
          ...assignment,
          submissionStatus: submission ? submission.status : "pending",
          isSubmitted: !!submission,
        };
      })
    );

    res.status(200).json({ success: true, data: enrichedAssignments });
  } catch (error) {
    next(error);
  }
}

async function getShiftChecklist(req, res, next) {
  try {
    const shiftId = parseId(req.params.shiftId);

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        shiftId,
        userId: req.user.sub,
        assignmentRole: "staff",
      },
      include: {
        shift: {
          include: {
            station: true,
          },
        },
      },
      orderBy: { assignmentDate: "desc" },
    });

    if (!assignment) {
      throw new ApiError(403, "You are not assigned to this shift.");
    }

    const template = await prisma.checklistTemplate.findFirst({
      where: {
        stationId: assignment.shift.stationId,
        isActive: true,
      },
      include: {
        items: { orderBy: { displayOrder: "asc" } },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });

    if (!template) {
      throw new ApiError(404, "No active checklist template found for this station.");
    }

    const existingSubmission = await prisma.checklistSubmission.findFirst({
      where: {
        shiftId,
        staffId: req.user.sub,
        submissionDate: assignment.assignmentDate,
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({
      success: true,
      data: {
        assignment,
        template,
        submission: existingSubmission,
      },
    });
  } catch (error) {
    next(error);
  }
}

async function submitChecklist(req, res, next) {
  try {
    const shiftId = parseId(req.params.shiftId);
    const parsed = submitChecklistSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed.", parsed.error.flatten());
    }
    const payload = parsed.data;

    const assignment = await prisma.shiftAssignment.findFirst({
      where: {
        shiftId,
        userId: req.user.sub,
        assignmentRole: "staff",
      },
      include: {
        shift: true,
      },
      orderBy: { assignmentDate: "desc" },
    });

    if (!assignment) {
      throw new ApiError(403, "You are not assigned to this shift.");
    }

    if (isShiftExpired(assignment.assignmentDate, assignment.shift.endTime)) {
      throw new ApiError(400, "Checklist submission is not allowed after shift expiry.");
    }

    const template = await prisma.checklistTemplate.findFirst({
      where: {
        stationId: assignment.shift.stationId,
        isActive: true,
      },
      include: {
        items: true,
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });

    if (!template) {
      throw new ApiError(404, "No active checklist template found for this station.");
    }

    const responseByItemId = new Map(
      payload.responses.map((item) => [item.templateItemId, item])
    );
    const missingMandatory = template.items.filter((item) => {
      if (!item.isMandatory) return false;
      const response = responseByItemId.get(item.id);
      // Ensure we check for both existence and completion status
      return !response || response.completed !== true;
    });

    if (missingMandatory.length > 0) {
      throw new ApiError(
        400,
        "Mandatory checklist items must be completed before submission.",
        {
          missingItemIds: missingMandatory.map((item) => item.id),
        }
      );
    }

    const submissionDate = payload.submissionDate
      ? new Date(payload.submissionDate)
      : assignment.assignmentDate;

    const saved = await prisma.$transaction(async (tx) => {
      const submissionWhere = {
        shiftId_staffId_submissionDate: {
          shiftId,
          staffId: req.user.sub,
          submissionDate,
        },
      };
      const itemResponses = payload.responses.map((item) => ({
        templateItemId: item.templateItemId,
        completed: item.completed ?? false,
        valueText: item.valueText,
        remark: item.remark,
      }));
      const existingSubmission = await tx.checklistSubmission.findFirst({
        where: {
          shiftId,
          staffId: req.user.sub,
          submissionDate,
        },
        select: { id: true },
      });

      const submission = await tx.checklistSubmission.upsert({
        where: submissionWhere,
        create: {
          stationId: assignment.shift.stationId,
          shiftId,
          templateId: template.id,
          staffId: req.user.sub,
          submissionDate,
          status: "submitted",
          staffRemark: payload.staffRemark ?? null,
          submittedAt: new Date(),
          items: {
            create: itemResponses,
          },
        },
        update: {
          stationId: assignment.shift.stationId,
          templateId: template.id,
          status: "submitted",
          staffRemark: payload.staffRemark ?? null,
          submittedAt: new Date(),
          supervisorId: null,
          supervisorComment: null,
          verifiedAt: null,
          rejectionReason: null,
          items: {
            deleteMany: {},
            create: itemResponses,
          },
        },
        include: {
          items: true,
          template: {
            include: {
              items: true,
            },
          },
        },
      });

      return {
        submission,
        wasUpdated: Boolean(existingSubmission),
      };
    });

    res.status(saved.wasUpdated ? 200 : 201).json({
      success: true,
      message: saved.wasUpdated
        ? "Checklist updated successfully."
        : "Checklist submitted successfully.",
      data: saved.submission,
    });
  } catch (error) {
    if (
      error?.code === "P2002" &&
      Array.isArray(error.meta?.target) &&
      error.meta.target.includes("shiftId") &&
      error.meta.target.includes("staffId") &&
      error.meta.target.includes("submissionDate")
    ) {
      return next(new ApiError(409, "Checklist has already been submitted for this task."));
    }
    next(error);
  }
}

module.exports = {
  getMyShiftsToday,
  getShiftChecklist,
  submitChecklist,
};
