import { SlotConfig } from '@luzmo/dashboard-contents-types';

export const defaultSlotConfigs: SlotConfig[] = [
  {
    name: 'category',
    rotate: false,
    label: 'Category',
    type: 'categorical',
    order: 1,
    options: { 
      isBinningDisabled: true,
      areDatetimeOptionsEnabled: true 
    },
    isRequired: true
  },
  {
    name: 'measure',
    rotate: true,
    label: 'Measure',
    type: 'numeric',
    order: 2,
    options: {
      isAggregationDisabled: false
    },
    isRequired: true
  },
  {
    name: 'legend',
    rotate: false,
    label: 'Legend',
    type: 'categorical',
    order: 3,
    options: {
      isBinningDisabled: true
    },
    isRequired: false
  }
];
