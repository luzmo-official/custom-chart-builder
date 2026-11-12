import { z } from 'zod';

export const ChartContextSchema = z.object({
  description: z.string(),
  synonyms: z.array(z.string()).optional()
});
