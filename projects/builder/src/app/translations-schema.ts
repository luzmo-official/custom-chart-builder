import { z } from 'zod';

const optionTranslationSchema = z.object({
  label: z.string().optional(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  tooltip: z.string().optional(),
  extraLabel: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  extraLabelTooltip: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  enum: z.record(z.string(), z.string()).optional()
}).passthrough();

const slotTranslationSchema = z.object({
  label: z.string().optional()
}).passthrough();

const groupTranslationSchema = z.object({
  label: z.string().optional()
}).passthrough();

const optionsTranslationsSchema = z.object({
  groups: z.record(z.string(), groupTranslationSchema).optional()
}).catchall(optionTranslationSchema);

const languageTranslationsSchema = z.object({
  slots: z.record(z.string(), slotTranslationSchema).optional(),
  options: optionsTranslationsSchema.optional()
});

export const TranslationsConfigSchema = z.record(z.string(), languageTranslationsSchema);
