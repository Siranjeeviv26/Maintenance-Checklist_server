const mongoose = require("mongoose");

const templateItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    isMandatory: { type: Boolean, default: false },
    displayOrder: { type: Number, default: 0 },
    inputType: { type: String, enum: ["boolean", "text", "number"], default: "boolean" },
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

const checklistTemplateSchema = new mongoose.Schema(
  {
    station: { type: mongoose.Schema.Types.ObjectId, ref: "Station", required: true },
    title: { type: String, required: true },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    items: [templateItemSchema],
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

module.exports = checklistTemplateSchema;
