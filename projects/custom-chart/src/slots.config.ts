import { SlotConfig, SlotName } from '@luzmo/dashboard-contents-types';

export const defaultSlotConfigs: SlotConfig[] = [
  {
    name: 'x' as any,
    rotate: false,
    label: 'X coordinate',
    type: 'numeric',
    order: 1,
    options: { isAggregationDisabled: true, isBinningDisabled: true, areDatetimeOptionsEnabled: true },
    isRequired: true
  },
  {
    name: 'y' as any,
    rotate: true,
    label: 'Y coordinate',
    type: 'numeric',
    order: 2,
    options: { isAggregationDisabled: true, isBinningDisabled: true, areDatetimeOptionsEnabled: true },
    isRequired: true
  }
]