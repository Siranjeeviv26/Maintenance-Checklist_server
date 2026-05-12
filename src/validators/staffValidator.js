const { z } = require("zod");

const submitChecklistSchema = z.object({
  responses: z.array(
    z.object({
      templateItemId: z.number().int().positive(),
      completed: z.boolean().optional(),
      valueText: z.string().optional(),
      remark: z.string().optional(),
    })
  ),
  staffRemark: z.string().optional(),
  submissionDate: z.string().datetime().optional(),
});

module.exports = {
  submitChecklistSchema,
};
