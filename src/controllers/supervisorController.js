const mongoose = require("mongoose");
const { ChecklistSubmission } = require("../models");
const ApiError = require("../utils/apiError");
const { reviewSchema } = require("../validators/supervisorValidator");

function parseId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "Invalid id parameter.");
  }
  return value;
}

function hasIncompleteMandatoryItems(submission) {
  const responseMap = new Map(
    submission.items.map((item) => [item.templateItemId.toString(), item.completed === true])
  );
  return submission.template.items.some(
    (item) => item.isMandatory && responseMap.get(item.id) !== true
  );
}

async function listSubmitted(req, res, next) {
  try {
    const status = req.query.status || "submitted";
    const submissions = await ChecklistSubmission.find({ status })
      .populate("station")
      .populate("shift")
      .populate("staff", "name email")
      .populate("template")
      .sort({ submittedAt: -1 });
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

    const submission = await ChecklistSubmission.findById(submissionId).populate("template");

    if (!submission) throw new ApiError(404, "Submission not found.");
    if (submission.status !== "submitted") {
      throw new ApiError(400, "Only submitted checklists can be approved.");
    }
    if (hasIncompleteMandatoryItems(submission)) {
      throw new ApiError(400, "Supervisors cannot approve incomplete checklists.");
    }

    submission.status = "approved";
    submission.supervisor = req.user.sub;
    submission.supervisorComment = parsed.data.supervisorComment ?? null;
    submission.verifiedAt = new Date();
    const updated = await submission.save();

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

    const submission = await ChecklistSubmission.findById(submissionId);
    if (!submission) throw new ApiError(404, "Submission not found.");
    if (submission.status !== "submitted") {
      throw new ApiError(400, "Only submitted checklists can be rejected.");
    }

    submission.status = "rejected";
    submission.supervisor = req.user.sub;
    submission.supervisorComment = parsed.data.supervisorComment ?? null;
    submission.rejectionReason = parsed.data.rejectionReason || "Rejected by supervisor.";
    submission.verifiedAt = new Date();
    const updated = await submission.save();

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
    const filter = {};
    if (req.query.shiftId) filter.shift = parseId(req.query.shiftId);
    if (req.query.date) {
      const start = new Date(`${req.query.date}T00:00:00.000Z`);
      const end = new Date(`${req.query.date}T23:59:59.999Z`);
      filter.submissionDate = { $gte: start, $lte: end };
    }

    const history = await ChecklistSubmission.find(filter)
      .populate("station")
      .populate("shift")
      .populate("staff", "name email")
      .populate("supervisor", "name email")
      .sort({ submissionDate: -1 });

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
