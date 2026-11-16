import { z } from 'zod';

export const ChartContextSchema = z.object({
  description: z.string().trim().min(1),
  synonyms: z.array(z.string().trim().min(1)).optional()
});
