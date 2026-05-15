const mongoose = require("mongoose");

const submissionItemSchema = new mongoose.Schema(
  {
    templateItemId: { type: mongoose.Schema.Types.ObjectId, required: true },
    completed: { type: Boolean, default: false },
    valueText: { type: String, default: null },
    remark: { type: String, default: null },
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

const checklistSubmissionSchema = new mongoose.Schema(
  {
    station: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift", required: true },
    template: { type: mongoose.Schema.Types.ObjectId, ref: "ChecklistTemplate", required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    submissionDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
    staffRemark: { type: String, default: null },
    submittedAt: { type: Date, default: null },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    supervisorComment: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
    items: [submissionItemSchema],
  },
  {
    timestamps: true,
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

checklistSubmissionSchema.index(
  { shift: 1, staff: 1, submissionDate: 1 },
  { unique: true }
);

module.exports = checklistSubmissionSchema;
