const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const { Station, User, Shift, ShiftAssignment, ChecklistTemplate, ChecklistSubmission } = require("../models");
const ApiError = require("../utils/apiError");
const {
  stationSchema,
  userSchema,
  shiftSchema,
  templateSchema,
} = require("../validators/adminValidator");

function parseId(value) {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, "Invalid id parameter.");
  }
  return value;
}

function validate(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiError(400, "Validation failed.", parsed.error.flatten());
  }
  return parsed.data;
}

// ─── Stations ────────────────────────────────────────────────────────────────

async function listStations(req, res, next) {
  try {
    const stations = await Station.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: stations });
  } catch (error) {
    next(error);
  }
}

async function createStation(req, res, next) {
  try {
    const data = validate(stationSchema, req.body);
    const created = await Station.create(data);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === 11000) return next(new ApiError(409, "Station code already exists."));
    next(error);
  }
}

async function updateStation(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const data = validate(stationSchema.partial(), req.body);
    const updated = await Station.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!updated) return next(new ApiError(404, "Station not found."));
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 11000) return next(new ApiError(409, "Station code already exists."));
    next(error);
  }
}

async function deleteStation(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const deleted = await Station.findByIdAndDelete(id);
    if (!deleted) return next(new ApiError(404, "Station not found."));
    res.status(200).json({ success: true, message: "Station deleted." });
  } catch (error) {
    next(error);
  }
}

// ─── Users ────────────────────────────────────────────────────────────────────

async function listUsers(req, res, next) {
  try {
    const users = await User.find()
      .select("name email role isActive panelName createdAt")
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: users });
  } catch (error) {
    next(error);
  }
}

async function createUser(req, res, next) {
  try {
    const payload = validate(userSchema, req.body);
    const passwordHash = await bcrypt.hash(payload.password, 10);
    const created = await User.create({
      name: payload.name,
      email: payload.email,
      passwordHash,
      role: payload.role,
      isActive: payload.isActive ?? true,
      panelName: payload.panelName ?? null,
    });
    const safeUser = created.toJSON();
    delete safeUser.passwordHash;
    res.status(201).json({ success: true, data: safeUser });
  } catch (error) {
    if (error.code === 11000) return next(new ApiError(409, "User email already exists."));
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
    const updateData = { ...payload };
    if (payload.password) {
      updateData.passwordHash = await bcrypt.hash(payload.password, 10);
    }
    delete updateData.password;

    const updated = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .select("name email role isActive panelName createdAt");
    if (!updated) return next(new ApiError(404, "User not found."));
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 11000) return next(new ApiError(409, "User email already exists."));
    next(error);
  }
}

async function deleteUser(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return next(new ApiError(404, "User not found."));
    res.status(200).json({ success: true, message: "User deleted." });
  } catch (error) {
    next(error);
  }
}

// ─── Shifts ───────────────────────────────────────────────────────────────────

async function _populateShiftWithAssignments(shiftId) {
  const shift = await Shift.findById(shiftId).populate("station", "name code");
  if (!shift) return null;
  const shiftJson = shift.toJSON();
  const assignments = await ShiftAssignment.find({ shift: shiftId }).populate(
    "user",
    "name role email"
  );
  shiftJson.assignments = assignments.map((a) => a.toJSON());
  return shiftJson;
}

async function listShifts(req, res, next) {
  try {
    const shifts = await Shift.find().populate("station", "name code").sort({ createdAt: -1 });
    const result = await Promise.all(
      shifts.map(async (shift) => {
        const shiftJson = shift.toJSON();
        const assignments = await ShiftAssignment.find({ shift: shift._id }).populate(
          "user",
          "name role email"
        );
        shiftJson.assignments = assignments.map((a) => a.toJSON());
        return shiftJson;
      })
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function createShift(req, res, next) {
  try {
    const payload = validate(shiftSchema, req.body);

    const shift = await Shift.create({
      station: payload.stationId,
      name: payload.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      timezone: payload.timezone ?? "Asia/Kolkata",
      isActive: payload.isActive ?? true,
    });

    const assignmentDate = new Date(payload.assignmentDate);
    const assignmentDocs = [
      ...payload.assignedStaffIds.map((userId) => ({
        shift: shift._id,
        user: userId,
        assignmentRole: "staff",
        assignmentDate,
      })),
      ...payload.assignedSupervisorIds.map((userId) => ({
        shift: shift._id,
        user: userId,
        assignmentRole: "supervisor",
        assignmentDate,
      })),
    ];

    if (assignmentDocs.length > 0) {
      await ShiftAssignment.insertMany(assignmentDocs, { ordered: false }).catch((err) => {
        if (err.code !== 11000 && err.writeErrors?.some((e) => e.code !== 11000)) throw err;
      });
    }

    const created = await _populateShiftWithAssignments(shift._id);
    res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.name === "CastError") return next(new ApiError(400, "Invalid station or user reference."));
    next(error);
  }
}

async function updateShift(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const payload = validate(shiftSchema.partial(), req.body);

    const updateData = {};
    if (payload.stationId !== undefined) updateData.station = payload.stationId;
    if (payload.name !== undefined) updateData.name = payload.name;
    if (payload.startTime !== undefined) updateData.startTime = payload.startTime;
    if (payload.endTime !== undefined) updateData.endTime = payload.endTime;
    if (payload.timezone !== undefined) updateData.timezone = payload.timezone;
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive;

    const shift = await Shift.findByIdAndUpdate(id, updateData, { new: true });
    if (!shift) return next(new ApiError(404, "Shift not found."));

    if (payload.assignmentDate || payload.assignedStaffIds || payload.assignedSupervisorIds) {
      await ShiftAssignment.deleteMany({ shift: id });
      const assignmentDate = payload.assignmentDate ? new Date(payload.assignmentDate) : new Date();
      const assignmentDocs = [
        ...((payload.assignedStaffIds || []).map((userId) => ({
          shift: id,
          user: userId,
          assignmentRole: "staff",
          assignmentDate,
        }))),
        ...((payload.assignedSupervisorIds || []).map((userId) => ({
          shift: id,
          user: userId,
          assignmentRole: "supervisor",
          assignmentDate,
        }))),
      ];
      if (assignmentDocs.length > 0) {
        await ShiftAssignment.insertMany(assignmentDocs, { ordered: false }).catch((err) => {
          if (err.code !== 11000 && err.writeErrors?.some((e) => e.code !== 11000)) throw err;
        });
      }
    }

    const updated = await _populateShiftWithAssignments(id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.name === "CastError") return next(new ApiError(400, "Invalid station or user reference."));
    next(error);
  }
}

async function deleteShift(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const deleted = await Shift.findByIdAndDelete(id);
    if (!deleted) return next(new ApiError(404, "Shift not found."));
    await ShiftAssignment.deleteMany({ shift: id });
    res.status(200).json({ success: true, message: "Shift deleted." });
  } catch (error) {
    next(error);
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

async function listTemplates(req, res, next) {
  try {
    const templates = await ChecklistTemplate.find()
      .populate("station", "name code")
      .sort({ createdAt: -1 });
    const result = templates.map((t) => {
      const tJson = t.toJSON();
      tJson.items = (tJson.items || []).sort((a, b) => a.displayOrder - b.displayOrder);
      return tJson;
    });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

async function createTemplate(req, res, next) {
  try {
    const payload = validate(templateSchema, req.body);
    const created = await ChecklistTemplate.create({
      station: payload.stationId,
      title: payload.title,
      version: payload.version ?? 1,
      isActive: payload.isActive ?? true,
      items: payload.items.map((item) => ({
        label: item.label,
        isMandatory: item.isMandatory ?? false,
        displayOrder: item.displayOrder,
        inputType: item.inputType ?? "boolean",
      })),
    });
    const createdJson = created.toJSON();
    createdJson.items = (createdJson.items || []).sort((a, b) => a.displayOrder - b.displayOrder);
    res.status(201).json({ success: true, data: createdJson });
  } catch (error) {
    if (error.name === "CastError") return next(new ApiError(400, "Invalid station reference."));
    next(error);
  }
}

async function updateTemplate(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const payload = validate(templateSchema.partial(), req.body);

    const updateData = {};
    if (payload.stationId !== undefined) updateData.station = payload.stationId;
    if (payload.title !== undefined) updateData.title = payload.title;
    if (payload.version !== undefined) updateData.version = payload.version;
    if (payload.isActive !== undefined) updateData.isActive = payload.isActive;
    if (payload.items !== undefined) {
      updateData.items = payload.items.map((item) => ({
        label: item.label,
        isMandatory: item.isMandatory ?? false,
        displayOrder: item.displayOrder,
        inputType: item.inputType ?? "boolean",
      }));
    }

    const updated = await ChecklistTemplate.findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .populate("station", "name code");
    if (!updated) return next(new ApiError(404, "Template not found."));

    const updatedJson = updated.toJSON();
    updatedJson.items = (updatedJson.items || []).sort((a, b) => a.displayOrder - b.displayOrder);
    res.status(200).json({ success: true, data: updatedJson });
  } catch (error) {
    if (error.name === "CastError") return next(new ApiError(400, "Invalid station reference."));
    next(error);
  }
}

async function deleteTemplate(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const deleted = await ChecklistTemplate.findByIdAndDelete(id);
    if (!deleted) return next(new ApiError(404, "Template not found."));
    res.status(200).json({ success: true, message: "Template deleted." });
  } catch (error) {
    next(error);
  }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

async function checklistReport(req, res, next) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.shiftId) filter.shift = parseId(req.query.shiftId);
    if (req.query.stationId) filter.station = parseId(req.query.stationId);

    const submissions = await ChecklistSubmission.find(filter)
      .populate("station", "name code")
      .populate("shift", "name startTime endTime")
      .populate("staff", "name email")
      .populate("supervisor", "name email")
      .sort({ createdAt: -1 });

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
