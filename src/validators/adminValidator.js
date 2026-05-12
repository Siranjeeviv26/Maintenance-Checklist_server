const { z } = require("zod");

const userRoleEnum = z.enum(["admin", "staff", "supervisor"]);
const inputTypeEnum = z.enum(["boolean", "text", "number"]);

const stationSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(2),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleEnum,
  isActive: z.boolean().optional(),
});

const shiftSchema = z.object({
  stationId: z.number().int().positive(),
  name: z.string().min(2),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  timezone: z.string().optional(),
  isActive: z.boolean().optional(),
  assignmentDate: z.string().datetime(),
  assignedStaffIds: z.array(z.number().int().positive()).optional().default([]),
  assignedSupervisorIds: z
    .array(z.number().int().positive())
    .optional()
    .default([]),
});

const templateItemSchema = z.object({
  label: z.string().min(1),
  isMandatory: z.boolean().optional().default(false),
  displayOrder: z.number().int().nonnegative().optional().default(0),
  inputType: inputTypeEnum.optional().default("boolean"),
});

const templateSchema = z.object({
  stationId: z.number().int().positive(),
  title: z.string().min(2),
  version: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  items: z.array(templateItemSchema).min(1),
});

module.exports = {
  stationSchema,
  userSchema,
  shiftSchema,
  templateSchema,
};
