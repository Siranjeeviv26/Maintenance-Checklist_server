const prisma = require("../config/prisma");
const ApiError = require("../utils/apiError");
const { reviewSchema } = require("../validators/supervisorValidator");

function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new ApiError(400, "Invalid id parameter.");
  }
  return id;
}

function hasIncompleteMandatoryItems(submission) {
  const responseMap = new Map(
    submission.items.map((item) => [item.templateItemId, item.completed === true])
  );
  return submission.template.items.some(
    (item) => item.isMandatory && responseMap.get(item.id) !== true
  );
}

async function listSubmitted(req, res, next) {
  try {
    const status = req.query.status || "submitted";
    const submissions = await prisma.checklistSubmission.findMany({
      where: { status },
      include: {
        station: true,
        shift: true,
        staff: { select: { id: true, name: true, email: true } },
        items: true,
        template: { include: { items: true } },
      },
      orderBy: { submittedAt: "desc" },
    });
    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    next(error);
  }
}

async function approveSubmission(req, res, next) {
  try {
    const submissionId = parseId(req.params.id);
    const parsed = reviewSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed.", parsed.error.flatten());
    }

    const submission = await prisma.checklistSubmission.findUnique({
      where: { id: submissionId },
      include: {
        items: true,
        template: { include: { items: true } },
      },
    });

    if (!submission) throw new ApiError(404, "Submission not found.");
    if (submission.status !== "submitted") {
      throw new ApiError(400, "Only submitted checklists can be approved.");
    }
    if (hasIncompleteMandatoryItems(submission)) {
      throw new ApiError(400, "Supervisors cannot approve incomplete checklists.");
    }

    const updated = await prisma.checklistSubmission.update({
      where: { id: submissionId },
      data: {
        status: "approved",
        supervisorId: req.user.sub,
        supervisorComment: parsed.data.supervisorComment,
        verifiedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Submission approved.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function rejectSubmission(req, res, next) {
  try {
    const submissionId = parseId(req.params.id);
    const parsed = reviewSchema.safeParse(req.body || {});
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed.", parsed.error.flatten());
    }

    const existing = await prisma.checklistSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!existing) throw new ApiError(404, "Submission not found.");
    if (existing.status !== "submitted") {
      throw new ApiError(400, "Only submitted checklists can be rejected.");
    }

    const updated = await prisma.checklistSubmission.update({
      where: { id: submissionId },
      data: {
        status: "rejected",
        supervisorId: req.user.sub,
        supervisorComment: parsed.data.supervisorComment,
        rejectionReason: parsed.data.rejectionReason || "Rejected by supervisor.",
        verifiedAt: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Submission rejected.",
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function shiftHistory(req, res, next) {
  try {
    const where = {};
    if (req.query.shiftId) where.shiftId = parseId(req.query.shiftId);
    if (req.query.date) {
      const start = new Date(`${req.query.date}T00:00:00.000Z`);
      const end = new Date(`${req.query.date}T23:59:59.999Z`);
      where.submissionDate = { gte: start, lte: end };
    }

    const history = await prisma.checklistSubmission.findMany({
      where,
      include: {
        station: true,
        shift: true,
        staff: { select: { id: true, name: true, email: true } },
        supervisor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { submissionDate: "desc" },
    });

    res.status(200).json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listSubmitted,
  approveSubmission,
  rejectSubmission,
  shiftHistory,
};
