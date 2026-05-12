const { z } = require("zod");

const reviewSchema = z.object({
  supervisorComment: z.string().optional(),
  rejectionReason: z.string().optional(),
});

module.exports = { reviewSchema };
