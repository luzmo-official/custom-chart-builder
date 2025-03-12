# Custom Chart Development Guide

## Overview

Key components:

1. **Slot Configuration** - Defines the slots for the chart
2. **Rendering Logic** - Determines how the chart is drawn and styled
3. **Query Building** - Controls how data is requested from the server
4. **Resize Handling** - Ensures your chart is responsive

To create a custom chart, you need to implement three main functions:
- `render()` - Draws the chart based on provided data
- `resize()` - Updates the chart when its container size changes
- `buildQuery()` - Constructs the data query to fetch appropriate data

## Slot Configuration

The slot configuration defines what data fields users can attach to your chart. Create a file named `slot-config.ts` with your desired configuration.

```typescript
import { SlotConfig } from '@luzmo/dashboard-contents-types';

/**
 * Example slot configurations for a chart
 */
export const defaultSlotConfigs: SlotConfig[] = [
  {
    name: 'category',          // Internal name for this data slot
    rotate: false,             // Whether the axis should be rotated
    label: 'Category',         // User-friendly name shown in the UI
    type: 'categorical',       // Type of data: 'categorical' or 'numeric'
    position: 'left',          // Position in the dashboard UI
    options: {},               // Additional options (can be empty)
    isRequired: true,          // Whether this slot must be filled
    canAcceptMultipleColumns: false,  // Allow multiple data columns?
    acceptableColumnTypes: ['hierarchy', 'numeric', 'datetime']  // Valid data types
  },
  {
    name: 'measure',
    rotate: true,
    label: 'Sales Value',
    type: 'numeric',
    position: 'right',
    options: {},
    isRequired: true,
    canAcceptMultipleColumns: true,  // Allow multiple measures
    canAcceptFormula: true,          // Allow formula inputs
    acceptableColumnTypes: ['numeric']
  }
];
```

## Required Functions

### 1. render() Function

The `render()` function is responsible for creating and drawing your chart.

```typescript
/**
 * Main render function for the chart
 */
export function render({
  container,          // HTML element where the chart will be drawn
  data = [],          // Array of data rows from the server
  slots = [],         // Slot configurations that are filled with data
  slotConfigurations = defaultSlotConfigs,  // Slot definitions
  options = {},       // Additional options
  language = 'en',    // Current language
  dimensions = { width: 600, height: 400 }  // Available dimensions
}) {
  // 1. Clear the container
  // 2. Check if data exists
  // 3. Extract and process data
  // 4. Create visualization (SVG, Canvas, etc.)
  // 5. Add interactivity
  // 6. Store state for resize
}
```

### 2. resize() Function

The `resize()` function handles responsive behavior when the chart container changes size.

```typescript
/**
 * Resize function for the chart
 */
export function resize({
  container,          // HTML element where the chart will be drawn
  slots = [],         // Slot configurations that are filled with data
  slotConfigurations = defaultSlotConfigs,  // Slot definitions
  options = {},       // Additional options
  language = 'en',    // Current language
  dimensions = { width: 600, height: 400 }  // New dimensions
}) {
  // 1. Check if container exists and has data
  // 2. Retrieve stored data from previous render
  // 3. Re-render with new dimensions
  // 4. Restore any previous selection state
}
```

### 3. buildQuery() Function

The `buildQuery()` function creates the data query that fetches the appropriate data from the server.

```typescript
/**
 * Build query function
 */
export function buildQuery({
  slots = [],          // Slots that are filled with data
  slotConfigurations = defaultSlotConfigs  // Slot definitions
}) {
  const measures = [];
  const dimensions = [];
  
  // Extract dimensions (categories) and measures
  // from the provided slots
  
  return {
    dimensions,    // Array of dimensions for the query
    measures,      // Array of measures for the query
    limit: { by: 12 }  // Optional limit on result count
  };
}
```

## Sending Filters (Not implemented yet)

```typescript
/**
 * Send filter via postMessage
 */
function sendFilter(categorySlot, selectedCategories) {
  if (!selectedCategories.length) {
    // Clear filters
    window.parent.postMessage({ event: 'setFilters', value: [] }, '*');
    return;
  }
  
  const filters = [{
    condition: 'or',
    filters: [
      {
        expression: '? in ?',
        parameters: [
          {
            column_id: categorySlot.content[0].column,
            dataset_id: categorySlot.content[0].set,
            level: 1
          },
          selectedCategories
        ]
      }
    ]
  }];
  
  window.parent.postMessage({ event: 'setFilters', value: filters }, '*');
}
```

## Best Practices

1. **Handle Empty States** - Always check if data is available and provide appropriate messaging
2. **Use TypeScript** - Define interfaces for better type safety
3. **Optimize Performance** - Minimize DOM manipulations and use efficient rendering techniques
4. **Test Different Data Shapes** - Ensure your chart works with varying amounts of data
5. **Implement Proper Cleanup** - Remove event listeners and clear elements when re-rendering
6. **Store State for Resize** - Save necessary data to properly handle resize operations

## Libraries and Tools

You can use any JavaScript library:

- D3.js
- Chart.js
- Highcharts
- ECharts
- Plain SVG or Canvas

## Final Steps

Once your chart is complete:
1. Bundle your code
2. Test thoroughly with various data sets
3. Package according to the platform guidelines
4. Upload to the custom chart system
