import { SlotConfig, SlotName } from '@luzmo/dashboard-contents-types';

export const defaultSlotConfigs: SlotConfig[] = [
  {
    name: 'category',
    label: 'Category',
    rotate: false,
    type: 'categorical',
    options: {
      areDatetimeOptionsEnabled: true
    },
    isRequired: false,
    canAcceptMultipleColumns: false,
    acceptableColumnTypes: [
      'hierarchy',
      'numeric',
      'datetime'
    ]
  },
  {
    name: 'measure',
    label: 'Measure',
    rotate: false,
    type: 'numeric',
    options: {},
    isRequired: false,
    canAcceptMultipleColumns: true,
    acceptableColumnTypes: [
      'hierarchy',
      'numeric',
      'datetime'
    ],
    canAcceptFormula: true
  }
]