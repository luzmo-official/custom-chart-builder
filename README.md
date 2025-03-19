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
│       └── src/
│           ├── chart.ts       # Main chart rendering logic
│           ├── chart.css      # Chart styles
│           ├── manifest.json  # Chart configuration and slot definitions
│           ├── icon.svg       # Chart icon
│           └── index.ts       # Entry point
```

## Creating a Custom Chart

### Chart Configuration

The `manifest.json` file defines your chart's slot configurations:

```json
{
  "slots": [
    {
      "name": "category",
      "rotate": false,
      "label": "Category",
      "type": "categorical",
      "options": { "isBinningDisabled": true },
      "isRequired": true
    },
    {
      "name": "measure",
      "rotate": true,
      "label": "Value",
      "type": "numeric",
      "options": { "isAggregationDisabled": false },
      "isRequired": true
    }
  ]
}
```

### Chart Implementation

Your chart needs to implement these functions:

1. **render()** - Creates and draws the chart (required method)
2. **resize()** - Updates the chart when its container size changes (required, if resizing is needed)
3. **buildQuery()** - Constructs data queries for your chart (optional, if not provided, luzmo dashboard will use built-in query mechanism)

Example implementation (simplified):

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
