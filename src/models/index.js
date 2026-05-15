const mongoose = require("mongoose");

const userSchema = require("./User");
const stationSchema = require("./Station");
const shiftSchema = require("./Shift");
const shiftAssignmentSchema = require("./ShiftAssignment");
const checklistTemplateSchema = require("./ChecklistTemplate");
const checklistSubmissionSchema = require("./ChecklistSubmission");

const User = mongoose.model("User", userSchema);
const Station = mongoose.model("Station", stationSchema);
const Shift = mongoose.model("Shift", shiftSchema);
const ShiftAssignment = mongoose.model("ShiftAssignment", shiftAssignmentSchema);
const ChecklistTemplate = mongoose.model("ChecklistTemplate", checklistTemplateSchema);
const ChecklistSubmission = mongoose.model("ChecklistSubmission", checklistSubmissionSchema);

module.exports = {
  User,
  Station,
  Shift,
  ShiftAssignment,
  ChecklistTemplate,
  ChecklistSubmission,
};
