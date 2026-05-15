const { z } = require("zod");

const submitChecklistSchema = z.object({
  responses: z.array(
    z.object({
      templateItemId: z.string().min(1),
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
