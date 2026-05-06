import type { SlotConfig, SlotName } from '@luzmo/dashboard-contents-types';
import { z } from 'zod';

const slotNameSchema = z.string().min(1) as z.ZodType<SlotName>;

const slotPositions = [
  'top-left',
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
  'middle'
] as const satisfies readonly NonNullable<SlotConfig['position']>[];

const slotTypes = [
  'numeric',
  'categorical',
  'mixed'
] as const satisfies readonly NonNullable<SlotConfig['type']>[];

const acceptableDataFieldTypes = [
  'numeric',
  'hierarchy',
  'datetime',
  'spatial',
  'array[numeric]',
  'array[hierarchy]',
  'array[datetime]',
  'array[spatial]'
] as const satisfies readonly NonNullable<SlotConfig['acceptableDataFieldTypes']>[number][];

const acceptableColumnSubtypes = [
  'duration',
  'currency',
  'coordinates',
  'hierarchy_element_expression',
  'topography',
  'ip_address',
  'interval'
] as const satisfies readonly NonNullable<SlotConfig['acceptableColumnSubtypes']>[number][];

const slotOptionsSchema = z.object({
  areDatetimeOptionsEnabled: z.boolean().optional(),
  areGrandTotalsEnabled: z.boolean().optional(),
  isAggregationDisabled: z.boolean().optional(),
  isBinningDisabled: z.boolean().optional(),
  isCumulativeSumEnabled: z.boolean().optional(),
  showOnlyFirstSlotContentOptions: z.boolean().optional(),
  showOnlyFirstSlotGrandTotals: z.boolean().optional()
}) satisfies z.ZodType<NonNullable<SlotConfig['options']>>;

const slotConfigSchema = z
  .object({
    name: slotNameSchema,
    acceptableColumnSubtypes: z.array(z.enum(acceptableColumnSubtypes)).optional(),
    acceptableColumnTypes: z.array(z.enum(acceptableDataFieldTypes)).optional(),
    acceptableDataFieldTypes: z.array(z.enum(acceptableDataFieldTypes)).optional(),
    activeWhenSubtype: z.array(z.string()).optional(),
    canAcceptDataIndependentOf: z.array(slotNameSchema).optional(),
    canAcceptFormula: z.boolean().optional(),
    canAcceptMultipleColumns: z.boolean().optional(),
    canAcceptMultipleDataFields: z.boolean().optional(),
    clearWhenOtherSlotHasMultipleItems: z.array(slotNameSchema).optional(),
    description: z.string().optional(),
    isHidden: z.boolean().optional(),
    isRequired: z.boolean().optional(),
    keepOnlyFirstWhenOtherSlotFilled: z.array(slotNameSchema).optional(),
    label: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
    noMultipleIfSlotsFilled: z.array(slotNameSchema).optional(),
    options: slotOptionsSchema.optional(),
    order: z.number().optional(),
    position: z.enum(slotPositions).optional(),
    requiredMinimumColumnsCount: z.number().optional(),
    rotate: z.boolean().optional(),
    type: z.enum(slotTypes).optional(),
  })
  .transform((slot): SlotConfig => ({
    ...slot,
    acceptableDataFieldTypes: slot.acceptableDataFieldTypes ?? slot.acceptableColumnTypes,
    canAcceptMultipleDataFields: slot.canAcceptMultipleDataFields ?? slot.canAcceptMultipleColumns
  }));

export const SlotsConfigSchema = z.array(slotConfigSchema) satisfies z.ZodType<SlotConfig[]>;
