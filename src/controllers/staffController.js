const mongoose = require("mongoose");
const { ShiftAssignment, ChecklistTemplate, ChecklistSubmission } = require("../models");
const ApiError = require("../utils/apiError");
const { submitChecklistSchema } = require("../validators/staffValidator");
const { isShiftExpired } = require("../utils/shiftTime");

const APP_TIMEZONE = "Asia/Kolkata";

function parseId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "Invalid id parameter.");
  }
  return value;
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

    const assignments = await ShiftAssignment.find({
      user: req.user.sub,
      assignmentRole: "staff",
      assignmentDate: { $gte: start, $lte: end },
    })
      .populate({ path: "shift", populate: { path: "station" } })
      .sort({ assignmentDate: 1 });

    const todayAssignments = assignments.filter(
      (a) => dateKeyInTimezone(a.assignmentDate) === todayKey
    );

    const enrichedAssignments = await Promise.all(
      todayAssignments.map(async (assignment) => {
        const submission = await ChecklistSubmission.findOne(
          {
            shift: assignment.shift._id,
            staff: req.user.sub,
            submissionDate: assignment.assignmentDate,
          },
          "status submittedAt"
        );
        const aJson = assignment.toJSON();
        aJson.submissionStatus = submission ? submission.status : "pending";
        aJson.isSubmitted = Boolean(submission);
        return aJson;
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

    const assignment = await ShiftAssignment.findOne({
      shift: shiftId,
      user: req.user.sub,
      assignmentRole: "staff",
    })
      .populate({ path: "shift", populate: { path: "station" } })
      .sort({ assignmentDate: -1 });

    if (!assignment) {
      throw new ApiError(403, "You are not assigned to this shift.");
    }

    const stationRef = assignment.shift.station._id ?? assignment.shift.station;
    const template = await ChecklistTemplate.findOne({
      station: stationRef,
      isActive: true,
    }).sort({ version: -1, createdAt: -1 });

    if (!template) {
      throw new ApiError(404, "No active checklist template found for this station.");
    }

    const templateJson = template.toJSON();
    templateJson.items = (templateJson.items || []).sort(
      (a, b) => a.displayOrder - b.displayOrder
    );

    const existingSubmission = await ChecklistSubmission.findOne({
      shift: shiftId,
      staff: req.user.sub,
      submissionDate: assignment.assignmentDate,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: {
        assignment,
        template: templateJson,
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

    const assignment = await ShiftAssignment.findOne({
      shift: shiftId,
      user: req.user.sub,
      assignmentRole: "staff",
    })
      .populate("shift")
      .sort({ assignmentDate: -1 });

    if (!assignment) {
      throw new ApiError(403, "You are not assigned to this shift.");
    }

    if (isShiftExpired(assignment.assignmentDate, assignment.shift.endTime)) {
      throw new ApiError(400, "Checklist submission is not allowed after shift expiry.");
    }

    const template = await ChecklistTemplate.findOne({
      station: assignment.shift.station,
      isActive: true,
    }).sort({ version: -1, createdAt: -1 });

    if (!template) {
      throw new ApiError(404, "No active checklist template found for this station.");
    }

    const responseByItemId = new Map(
      payload.responses.map((item) => [item.templateItemId, item])
    );
    const missingMandatory = template.items.filter((item) => {
      if (!item.isMandatory) return false;
      const response = responseByItemId.get(item.id);
      return !response || response.completed !== true;
    });

    if (missingMandatory.length > 0) {
      throw new ApiError(
        400,
        "Mandatory checklist items must be completed before submission.",
        { missingItemIds: missingMandatory.map((item) => item.id) }
      );
    }

    const submissionDate = payload.submissionDate
      ? new Date(payload.submissionDate)
      : assignment.assignmentDate;

    const itemResponses = payload.responses.map((item) => ({
      templateItemId: item.templateItemId,
      completed: item.completed ?? false,
      valueText: item.valueText ?? null,
      remark: item.remark ?? null,
    }));

    const existingSubmission = await ChecklistSubmission.findOne({
      shift: shiftId,
      staff: req.user.sub,
      submissionDate,
    });

    const wasUpdated = Boolean(existingSubmission);
    let submission;

    if (wasUpdated) {
      existingSubmission.station = assignment.shift.station;
      existingSubmission.template = template._id;
      existingSubmission.status = "submitted";
      existingSubmission.staffRemark = payload.staffRemark ?? null;
      existingSubmission.submittedAt = new Date();
      existingSubmission.supervisor = null;
      existingSubmission.supervisorComment = null;
      existingSubmission.verifiedAt = null;
      existingSubmission.rejectionReason = null;
      existingSubmission.items = itemResponses;
      submission = await existingSubmission.save();
    } else {
      submission = await ChecklistSubmission.create({
        station: assignment.shift.station,
        shift: shiftId,
        template: template._id,
        staff: req.user.sub,
        submissionDate,
        status: "submitted",
        staffRemark: payload.staffRemark ?? null,
        submittedAt: new Date(),
        items: itemResponses,
      });
    }

    await submission.populate("template");

    res.status(wasUpdated ? 200 : 201).json({
      success: true,
      message: wasUpdated
        ? "Checklist updated successfully."
        : "Checklist submitted successfully.",
      data: submission,
    });
  } catch (error) {
    if (error.code === 11000) {
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
