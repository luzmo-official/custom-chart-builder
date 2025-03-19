# Luzmo Custom Chart Builder

A powerful development environment for creating, testing, and packaging custom chart components for Luzmo dashboards.

![Luzmo Custom Chart Builder](https://img.shields.io/badge/Luzmo-Custom%20Chart-blue)

## Overview

The Luzmo Custom Chart Builder provides a complete workflow for developing custom chart visualizations. This toolkit includes:

- An interactive development environment with live preview
- Configurable data slots for chart customization
- Automatic build and refresh on code changes
- Schema validation for chart configuration
- Production-ready packaging tools

## Quick Start

### Prerequisites

- Node.js (v16+)
- npm

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/luzmo-official/custom-chart-builder.git
   cd custom-chart-builder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```
   
   This will automatically install dependencies for both the root project and the custom chart component.

### Development

Start the development environment with a single command:

```bash
npm run start
```

This command launches:
- The Angular development server
- A bundle server for custom chart assets
- A file watcher that rebuilds on changes

Your development environment will be available at [http://localhost:4200](http://localhost:4200)

## Project Structure

```
custom-chart-builder/
├── custom-chart-build-output/  # Production build files
├── projects/
│   ├── builder/               # Angular application for the chart builder UI
│   └── custom-chart/          # Custom chart implementation
│       ├── scripts/           # Build and utility scripts
|       |-- utils/             # Utilities and models
│       └── src/
│           ├── chart.ts       # Main chart rendering logic
│           ├── chart.css      # Chart styles
│           ├── manifest.json  # Chart configuration and slot definitions
│           ├── icon.svg       # Chart icon
│           └── index.ts       # Entry point
```

## Creating Your Own Custom Chart

### Key Files to Modify

To create your own chart, you'll primarily need to edit these three files:

1. **chart.ts** - This is where you'll implement the chart rendering logic
2. **manifest.json** - Define your chart's data slots and configuration
3. **chart.css** - Add styles for your chart's visual appearance

### Implementing Your Chart in chart.ts

The `chart.ts` file contains the core logic for your chart. You need to implement three main functions:

#### 1. render() Function

The `render()` function creates and draws your chart:

```typescript
// Import required types
import { Slot, SlotConfig, ItemQuery, ItemQueryDimension, ItemQueryMeasure } from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';

// Define the complete interface for chart parameters
interface ChartParams {
  container: HTMLElement;           // The DOM element where your chart will be rendered
  data: any[][];                    // The data rows from the server
  slots: Slot[];                    // The filled slots with column mappings
  slotConfigurations: SlotConfig[]; // The configuration of available slots
  options: Record<string, any>;     // Additional options passed to the chart
  language: string;                 // Current language code (e.g., 'en')
  dimensions: {                     // Available dimensions for rendering
    width: number;
    height: number;
  };
}

// Render function implementation
export function render({
  container,
  data = [],
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width = 600, height = 400 } = {}
}: ChartParams): void {
  // 1. Clear the container
  container.innerHTML = '';
  
  // 2. Check if data exists
  const hasData = data && data.length > 0;
  
  // 3. Extract and process data
  const chartData = hasData ? data.map(row => ({
    category: String(row[0]?.name?.en || row[0] || 'Unknown'),
    value: Number(row[1] || 0)
  })) : [];
  
  // 4. Create visualization (SVG, Canvas, etc.)
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // 5. Add your chart elements here
  
  // 6. Store state for resize
  (container as any).__chartData = chartData;
}
```

#### 2. resize() Function

The `resize()` function handles responsive behavior when the chart container changes size:

```typescript
export function resize({
  container,
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width = 600, height = 400 } = {}
}: ChartParams): void {
  // 1. Retrieve stored data from previous render
  const chartData = (container as any).__chartData || [];
  
  // 2. Clear container but preserve data
  container.innerHTML = '';
  
  // 3. Re-render with new dimensions
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  // 4. Redraw with stored data
  // Your chart rendering code using the chartData
  
  // 5. Maintain state for future resizes
  (container as any).__chartData = chartData;
}
```

#### 3. buildQuery() Function

The `buildQuery()` function creates the data query that fetches the appropriate data from the server:

```typescript
interface BuildQueryParams {
  slots: Slot[];
  slotConfigurations: SlotConfig[];
}

export function buildQuery({
  slots = [],
  slotConfigurations = []
}: BuildQueryParams): ItemQuery {
  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];
  
  // Extract category dimension
  const categorySlot = slots.find(s => s.name === 'category');
  if (categorySlot?.content.length! > 0) {
    const category = categorySlot!.content[0];
    dimensions.push({
      dataset_id: category.datasetId || category.set,
      column_id: category.columnId || category.column,
      level: category.level || 1
    });
  }
  
  // Extract measure
  const measureSlot = slots.find(s => s.name === 'measure');
  if (measureSlot?.content.length! > 0) {
    const measure = measureSlot!.content[0];
    
    // Handle different types of measures
    if (measure.aggregationFunc && ['sum', 'average', 'min', 'max', 'count'].includes(measure.aggregationFunc)) {
      measures.push({
        dataset_id: measure.datasetId || measure.set,
        column_id: measure.columnId || measure.column,
        aggregation: { type: measure.aggregationFunc }
      });
    } else {
      measures.push({
        dataset_id: measure.datasetId || measure.set,
        column_id: measure.columnId || measure.column
      });
    }
  }
  
  return {
    dimensions,
    measures,
    limit: { by: 100 }, // Limit to 100 rows for performance
    options: {
      locale_id: 'en',
      timezone_id: 'UTC',
      rollup_data: true
    }
  };
}
```

### Configuring manifest.json

The `manifest.json` file defines the data slots that users can drag and drop in the dashboard. This file is validated against a Zod schema to ensure compatibility with the Luzmo platform.

Example configuration:

```json
{
  "slots": [
    {
      "name": "category",
      "rotate": false,
      "label": "Category",
      "type": "categorical",
      "order": 1,
      "options": { 
        "isBinningDisabled": true,
        "areDatetimeOptionsEnabled": true 
      },
      "isRequired": true
    },
    {
      "name": "measure",
      "rotate": true,
      "label": "Value",
      "type": "numeric",
      "order": 2,
      "options": {
        "isAggregationDisabled": false
      },
      "isRequired": true
    },
    {
      "name": "legend",
      "rotate": false,
      "label": "Legend",
      "type": "categorical",
      "order": 3,
      "options": {
        "isBinningDisabled": true
      },
      "isRequired": false
    }
  ]
}
```

Valid slot configuration options include:

- **name**: Internal identifier for the slot (required)
- **label**: User-facing name displayed in the interface (required)
- **type**: Data type - 'categorical', 'numeric', or 'datetime' (required)
- **rotate**: Whether the axis should be rotated (boolean)
- **order**: Display order in the interface (number)
- **isRequired**: Whether this slot must be filled (boolean)
- **options**: Additional configuration options
  - **isBinningDisabled**: Disable binning for categorical fields
  - **areDatetimeOptionsEnabled**: Enable date formatting options
  - **isAggregationDisabled**: Disable aggregation functions

### Styling with chart.css

The `chart.css` file allows you to add custom styles to your chart elements. The CSS is bundled with your chart and isolated from the dashboard styles:

```css
/* Container styles */
.bar-chart-container {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Chart title styles */
.chart-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

/* Axis styles */
.axis path,
.axis line {
  stroke: #e0e0e0;
}

.axis text {
  font-size: 12px;
  fill: #666;
}

/* Bar styles */
.bar {
  transition: opacity 0.2s;
}

.bar:hover {
  opacity: 0.8;
}

/* Legend styles */
.legend-item {
  display: inline-flex;
  align-items: center;
  margin-right: 10px;
  font-size: 12px;
}

/* Empty state styles */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  text-align: center;
}
```

Your CSS will be minified during the build process and included in the final chart package.



## Building and Packaging

### Development Build

To build the chart during development:

```bash
npm run build
```

This will compile the chart and place files in the `custom-chart-build-output` directory.

### Production Package

To create a distribution-ready package:

```bash
npm run archive
```

This command:
1. Builds the chart
2. Validates the manifest.json against the schema
3. Creates a ZIP archive (bundle.zip) ready for distribution

### Validation Only

To validate your manifest.json without building:

```bash
npm run validate
```

## Adding Custom Libraries

You can use any JavaScript visualization libraries:

- D3.js (included by default)
- Chart.js
- Highcharts
- ECharts
- Plain SVG or Canvas

Add them to the custom-chart package.json and import them in your chart.ts file.

## Troubleshooting

### Common Issues

- **Manifest validation errors**: Check your slot configuration against the schema
- **Chart not rendering**: Verify your data structure matches what your render function expects
- **Build errors**: Check the console for detailed error messages

### Logs and Debugging

- Builder logs appear with the [ANGULAR] prefix
- Bundle server logs appear with the [BUNDLE] prefix 
- Chart watcher logs appear with the [WATCHER] prefix

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Resources

- [Luzmo Documentation](https://developer.luzmo.com)
- [Custom Chart API Reference](https://developer.luzmo.com)
- [D3.js Documentation](https://d3js.org)
