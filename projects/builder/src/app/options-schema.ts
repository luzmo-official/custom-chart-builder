import type { OptionConfig, OptionsConfig } from '@luzmo/dashboard-contents-types';
import { z } from 'zod';

const unsafeOptionKeyParts = new Set(['__proto__', 'constructor', 'prototype']);
const reservedOptionKey = 'theme';

const isSafeOptionKey = (key: string): boolean => key.split('.').every((part) => !unsafeOptionKeyParts.has(part));
const isReservedOptionKey = (key: string): boolean => key === reservedOptionKey || key.startsWith(`${reservedOptionKey}.`);

const controlConfigSchema = z.object({
  type: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  tooltip: z.string().optional(),
  default: z.unknown().optional(),
  enum: z.union([z.array(z.string()), z.record(z.string(), z.unknown())]).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional()
}).passthrough();

const optionConfigSchema: z.ZodType<OptionConfig> = z.lazy(() => z.object({
  key: z.string()
    .refine(isSafeOptionKey, 'Option keys cannot contain unsafe path segments')
    .refine((key) => !isReservedOptionKey(key), 'Option keys cannot target the reserved "theme" path')
    .optional(),
  type: z.string().optional(),
  label: z.string().optional(),
  open: z.boolean().optional(),
  control: controlConfigSchema.optional(),
  children: z.array(optionConfigSchema).optional()
}).passthrough());

export const OptionsConfigSchema = z.array(optionConfigSchema) satisfies z.ZodType<OptionsConfig>;
