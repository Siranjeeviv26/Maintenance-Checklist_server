const mongoose = require("mongoose");

const shiftAssignmentSchema = new mongoose.Schema(
  {
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignmentRole: { type: String, enum: ["staff", "supervisor"], required: true },
    assignmentDate: { type: Date, required: true },
  },
  {
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
      },
    },
    toObject: { virtuals: true },
  }
);

shiftAssignmentSchema.index(
  { shift: 1, user: 1, assignmentDate: 1, assignmentRole: 1 },
  { unique: true }
);

module.exports = shiftAssignmentSchema;
