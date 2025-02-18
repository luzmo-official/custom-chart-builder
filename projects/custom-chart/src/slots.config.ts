import { SlotConfig, SlotName } from '@luzmo/dashboard-contents-types';

export const defaultSlotConfigs: SlotConfig[] = [
  {
    name: 'date' as SlotName,
    label: 'Date',
    rotate: false,
    type: 'categorical',
    options: {
      areDatetimeOptionsEnabled: true,
    },
    isRequired: true,
    canAcceptMultipleColumns: false,
    acceptableColumnTypes: ['datetime'],
  },
  {
    name: 'order',
    label: 'Order',
    rotate: false,
    type: 'categorical',
    isRequired: true,
    canAcceptMultipleColumns: false,
    acceptableColumnTypes: ['hierarchy', 'numeric', 'datetime'],
  },
  {
    name: 'category',
    label: 'Category',
    rotate: false,
    type: 'categorical',
    options: {
      areDatetimeOptionsEnabled: true,
    },
    isRequired: true,
    canAcceptMultipleColumns: true,
    acceptableColumnTypes: ['hierarchy', 'numeric', 'datetime'],
  },
  {
    name: 'measure',
    label: 'Measure',
    rotate: false,
    type: 'numeric',
    options: {},
    isRequired: true,
    canAcceptMultipleColumns: true,
    acceptableColumnTypes: ['hierarchy', 'numeric', 'datetime'],
    canAcceptFormula: true,
  },
];
