import type {
  ColumnSubtype,
  ColumnType,
  FormulaSubtype,
  FormulaType,
  SlotConfig,
  SlotName
} from '@luzmo/dashboard-contents-types';
import { z } from 'zod';

const slotNameSchema = z.string().min(1) as z.ZodType<SlotName>;
const slotNameArraySchema = z.array(slotNameSchema);

const dataFieldTypeSchema = z.enum([
  'array[datetime]',
  'array[hierarchy]',
  'array[numeric]',
  'array[spatial]',
  'datetime',
  'hierarchy',
  'numeric',
  'spatial'
]) as z.ZodType<ColumnType | FormulaType>;

const dataFieldSubtypeSchema = z.enum([
  'coordinates',
  'currency',
  'duration',
  'hierarchy_element_expression',
  'interval',
  'ip_address',
  'topography'
]) as z.ZodType<ColumnSubtype | FormulaSubtype>;

/**
 * Generated from @luzmo/dashboard-contents-types:SlotConfig.
 *
 * @todo: Extract to common folder
 */
const slotConfigShape = {
  name: slotNameSchema,
  position: z.enum(['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left', 'middle']).optional(),
  label: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  description: z.string().optional(),
  type: z.enum(['numeric', 'categorical', 'mixed']).optional(),
  order: z.number().optional(),
  acceptableDataFieldTypes: z.array(dataFieldTypeSchema).optional(),
  acceptableColumnTypes: z.array(dataFieldTypeSchema).optional(),
  acceptableColumnSubtypes: z.array(dataFieldSubtypeSchema).optional(),
  canAcceptFormula: z.boolean().optional(),
  rotate: z.boolean().optional(),
  canAcceptMultipleDataFields: z.boolean().optional(),
  canAcceptMultipleColumns: z.boolean().optional(),
  requiredMinimumColumnsCount: z.number().optional(),
  isRequired: z.boolean().optional(),
  isHidden: z.boolean().optional(),
  keepOnlyFirstWhenOtherSlotFilled: slotNameArraySchema.optional(),
  clearWhenOtherSlotHasMultipleItems: slotNameArraySchema.optional(),
  noMultipleIfSlotsFilled: slotNameArraySchema.optional(),
  canAcceptDataIndependentOf: slotNameArraySchema.optional(),
  activeWhenSubtype: z.array(z.string()).optional(),
  options: z
    .object({
      isBinningDisabled: z.boolean().optional(),
      isAggregationDisabled: z.boolean().optional(),
      areGrandTotalsEnabled: z.boolean().optional(),
      showOnlyFirstSlotGrandTotals: z.boolean().optional(),
      isCumulativeSumEnabled: z.boolean().optional(),
      areDatetimeOptionsEnabled: z.boolean().optional(),
      showOnlyFirstSlotContentOptions: z.boolean().optional()
    })
    .strict()
    .optional()
} satisfies Record<keyof SlotConfig, z.ZodTypeAny>;

export const SlotsConfigSchema: z.ZodType<SlotConfig[]> = z.array(
  z.object(slotConfigShape).strict()
);
