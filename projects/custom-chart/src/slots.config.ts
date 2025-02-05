import { SlotConfig, SlotName } from '@luzmo/dashboard-contents-types';

export const defaultSlotConfigs: SlotConfig[] = [
  {
    name: 'x' as any,
    rotate: false,
    label: 'X coordinate',
    type: 'mixed',
    options: { isAggregationDisabled: true, isBinningDisabled: true, areDatetimeOptionsEnabled: true },
    isRequired: true
  },
  {
    name: 'y' as any,
    rotate: true,
    label: 'Y coordinate',
    type: 'mixed',
    options: { isAggregationDisabled: true, isBinningDisabled: true, areDatetimeOptionsEnabled: true },
    isRequired: true
  }
]