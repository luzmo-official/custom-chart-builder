# Luzmo Custom Chart Builder

A powerful development environment for creating, testing, and packaging custom charts for Luzmo dashboards.

## Table of Contents

- [Overview](#overview)
- [Quick start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
- [Project structure](#project-structure)
- [Creating your own Custom Chart](#creating-your-own-custom-chart)
  - [Defining the slot configuration in manifest.json](#defining-the-slot-configuration-in-manifestjson)
    - [Required properties](#required-properties)
    - [Optional properties](#optional-properties)
    - [Slot options properties](#slot-options-properties)
  - [Implementing your chart in chart.ts](#implementing-your-chart-in-chartts)
    - [render() function](#render-function)
    - [resize() function](#resize-function)
    - [buildQuery() function (optional)](#buildquery-function-optional)
  - [Data formatting](#data-formatting)
  - [Chart styling](#chart-styling)
    - [Using the dashboard or chart theme](#using-the-dashboard-or-chart-theme)
    - [Styling with chart.css](#styling-with-chartcss)
  - [Interacting with the dashboard](#interacting-with-the-dashboard)
    - [Filter event (setFilter)](#filter-event-setfilter)
    - [Custom event (customEvent)](#custom-event-customevent)
    - [Query loaded event (queryLoaded)](#query-loaded-event-queryloaded)
- [Adding third party libraries](#adding-third-party-libraries)
- [Building and packaging](#building-and-packaging)
  - [Production package](#production-package)
  - [Validation only](#validation-only)
- [Troubleshooting](#troubleshooting)
  - [Common issues](#common-issues)
  - [Logs and debugging](#logs-and-debugging)
- [License](#license)
- [Resources](#resources)

## Overview

This Luzmo Custom Chart Builder provides a complete workflow for developing custom Luzmo visualizations. This toolkit includes:

- An interactive development environment with live preview
- Configurable data slots for chart customization
- Automatic build and refresh on code changes
- Schema validation for chart configuration
- Production-ready packaging tools

## Quick start

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


When you first access the development environment, you'll be presented with a login page. You'll need to log in with your Luzmo account credentials

After successful authentication, you'll be redirected to the chart builder environment where you can access and use your Luzmo datasets to test your custom chart

## Project structure

```
custom-chart-builder/
├── custom-chart-build-output/  # Production build files
├── projects/
│   ├── builder/               # Angular application for the chart builder UI
│   └── custom-chart/          # Custom chart implementation
│       └── src/
│           ├── chart.ts       # Main chart rendering logic
│           ├── chart.css      # Chart styles
│           ├── manifest.json  # Chart configuration and slot definitions
│           ├── icon.svg       # Chart icon
│           └── index.ts       # Entry point
```

## Creating your own Custom Chart

To create your own chart, you'll primarily need to edit these three files:

1. **manifest.json** - define your chart's data slots and configuration.
2. **chart.ts** - this is where you'll implement the chart rendering logic.
3. **chart.css** - add styles for your chart's visual appearance.

### Defining the slot configuration in manifest.json

The `manifest.json` file defines the data slots of your custom chart. A data slot can receive one or multiple columns from your datasets. These slot definitions determine what type of columns are accepted by your chart and how these options are displayed in Luzmo's dashboard editor.

When a user adds a column to one of the data slots in the chart, Luzmo will automatically query the aggregated data, respecting any applied filters.

This manifest file is validated against a Zod schema to ensure compatibility with the Luzmo platform.

#### Required properties

| Parameter | Description |
|----------|-------------|
| **`name`**<br>`STRING` | **Internal identifier for the slot**. **Note**: within one chart, all slots must have unique names! Must be one of: `x-axis`, `y-axis`, `category`, `measure`, `coordinates`, `legend`, `geo`, `image`, `color`, `levels`, `slidermetric`, `dimension`, `destination`, `source`, `time`, `identifier`, `target`, `size`, `name`, `columns`, `column`, `row`, `evolution`, `close`, `open`, `low`, `high`, `order`, `route` |
| **`label`**<br>`STRING` | **User-facing name displayed in the interface**. Can be a string or a localized string. |

#### Optional properties

| Parameter | Description |
|----------|-------------|
| **`description`**<br>`STRING` | Short explanation of the slot's purpose. |
| **`position`**<br>`STRING` | Position of the slot in the chart overlay in the dashboard editor. Must be one of: `top-left`, `top`, `top-right`, `right`, `bottom-right`, `bottom`, `bottom-left`, `left`, `middle`. |
| **`type`**<br>`STRING` | Data type. Must be  `'categorical'` or `'numeric'`. If set to `'categorical'`, columns in this slot will be added to the `dimensions` part of the query. If set to `'numeric'`, columns in this slot will be added to the `measures` part of the query. This is used to determine how data is aggregated. |
| **`rotate`**<br>`BOOLEAN` | Whether the axis should be rotated. |
| **`order`**<br>`NUMBER` | Display order in the interface. |
| **`isRequired`**<br>`BOOLEAN` | Whether the slot must be filled. |
| **`acceptableColumnTypes`**<br>`ARRAY` | Array of allowed column types. Must be one of: `'numeric'`, `'hierarchy'`, `'datetime'`, `'spatial'`. |
| **`acceptableColumnSubtypes`**<br>`ARRAY` | Array of specific column subtypes. Must be one of: `'duration'`, `'currency'`, `'coordinates'`, `'topography'`. |
| **`canAcceptFormula`**<br>`BOOLEAN` | Whether this slot can accept a formula-based column. |
| **`canAcceptMultipleColumns`**<br>`BOOLEAN` | Whether multiple columns can be placed in this slot. |
| **`requiredMinimumColumnsCount`**<br>`NUMBER` | Minimum number of columns required. |
| **`noMultipleIfSlotsFilled`**<br>`ARRAY` | Array of slot names that prevent multiple columns when filled. |
| **`options`**<br>`OBJECT` | Additional options for the slot. See Slot options properties below. |

#### Slot options properties

| Parameter | Description |
|----------|-------------|
| **`isBinningDisabled`**<br>`BOOLEAN` | Disable binning for categorical fields. |
| **`areDatetimeOptionsEnabled`**<br>`BOOLEAN` | Enable date/time-based options. |
| **`isAggregationDisabled`**<br>`BOOLEAN` | Disable aggregation functions. |
| **`areGrandTotalsEnabled`**<br>`BOOLEAN` | Enable grand totals. |
| **`showOnlyFirstSlotGrandTotals`**<br>`BOOLEAN` | Only show grand totals for first slot. |
| **`isCumulativeSumEnabled`**<br>`BOOLEAN` | Enable cumulative sum calculations. |
| **`showOnlyFirstSlotContentOptions`**<br>`BOOLEAN` | Only apply content options to first slot. |

Example configuration of a custom chart with two slots, Category and Measure:

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
      "isRequired": true,
      "position": "bottom"
    },
    {
      "name": "measure",
      "rotate": false,
      "label": "Measure",
      "type": "numeric",
      "order": 2,
      "options": {
        "isAggregationDisabled": false
      },
      "isRequired": true,
      "position": "middle"
    }
  ]
}
```


### Implementing your chart in chart.ts

The `chart.ts` file contains the core logic for your chart. You need to implement three main functions:

#### render() function

The `render()` function creates and draws your chart:

```typescript
// Import required types
import { Slot, SlotConfig, ItemQuery, ItemQueryDimension, ItemQueryMeasure, ThemeConfig } from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';

// Define the complete interface for chart parameters
interface ChartParams {
  container: HTMLElement;           // The DOM element where your chart will be rendered
  data: any[][];                    // The data rows from the server
  slots: Slot[];                    // The filled slots with column mappings
  slotConfigurations: SlotConfig[]; // The configuration of available slots
  options: Record<string, any> & { theme: ThemeConfig };     // Additional options passed to the chart
  language: string;                 // Current language code (e.g., 'en')
  dimensions: {                     // Width and height of the chart container in pixels
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
  
  // 5. Add your chart elements here...
  
  // 6. Store state for resize
  (container as any).__chartData = chartData;
}
```

#### resize() function

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

#### buildQuery() function (optional)

> **IMPORTANT:** The `buildQuery()` method is completely optional. If you don't implement this method, Luzmo will automatically generate and run the appropriate query for your chart based on the slots configuration. You only need to implement this method if you want to customize the query behavior.

Example implementation:

```typescript
interface BuildQueryParams {
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  limit?: ItemQuery['limit'];
}

export function buildQuery({
  slots = [],
  slotConfigurations = [],
  limit = { by: 100000, offset: 0 }
}: BuildQueryParams): ItemQuery {
  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];
  
  // Extract category dimension
  const categorySlot = slots.find(slot => slot.name === 'category');
  const categoryContent = categorySlot?.content;

  if (categoryContent?.length > 0) {
    const [category] = categoryContent;
    dimensions.push({
      dataset_id: category.datasetId,
      column_id: category.columnId,
      level: category.level || 1
    });
  }

  // Extract measure
  const measureSlot = slots.find(slot => slot.name === 'measure');
  const measureContent = measureSlot?.content;

  if (measureContent?.length > 0) {
    const [measure] = measureContent;

    // Handle different types of measures
    if (measure.aggregationFunc && ['sum', 'average', 'min', 'max', 'count'].includes(measure.aggregationFunc)) {
      measures.push({
        dataset_id: measure.datasetId,
        column_id: measure.columnId,
        aggregation: { type: measure.aggregationFunc }
      });
    }
    else {
      measures.push({
        dataset_id: measure.datasetId,
        column_id: measure.columnId
      });
    }
  }

  return {
    dimensions,
    measures,
    order: categoryContent?.[0] ? [{ dataset_id: categoryContent[0].datasetId, column_id: categoryContent[0].columnId, order: 'asc' }] : [],
    limit,
    options: {
      locale_id: 'en',
      timezone_id: 'UTC',
      rollup_data: true
    }
  };
}
```

For more information about the query syntax and available options, see the [Luzmo Query Syntax Documentation](https://developer.luzmo.com/guide/interacting-with-data--querying-data#api-query-syntax).

You can notify the dashboard that the query has been built by sending a `queryLoaded` event to the parent window:

```typescript
window.parent.postMessage({ type: 'queryLoaded', query }, '*');
```

### Data formatting

Luzmo provides a powerful formatter utility that helps format your data based on the format configured for the column (which can be changed by the user in the dashboard editor). You can import this utility from `@luzmo/analytics-components-kit/utils`:

```typescript
import { formatter } from '@luzmo/analytics-components-kit/utils';
```

It takes a slot content (i.e. a column) as an argument and returns a function that formats the data based on the format configured for the column.

The formatter function automatically handles:
- Number formatting (thousands separators, decimal places)
- Date/time formatting
- Currency formatting
- Percentage formatting

Example usage in your chart:

```typescript
import { formatter } from '@luzmo/analytics-components-kit/utils';

export function render({ data, slots }: ChartParams): void {
  // Create formatters for your slots
  const measureFormatter = slots.find(s => s.name === 'measure')?.content[0]
    ? formatter(slots.find(s => s.name === 'measure')!.content[0])
    : (val: any) => String(val);

  const categoryFormatter = slots.find(s => s.name === 'category')?.content[0]
    ? formatter(slots.find(s => s.name === 'category')!.content[0])
    : (val: any) => String(val);

  const categoryValue = row[0]?.name?.en || row[0] || 'Unknown';
  
  const formattedCategory = categoryFormatter(
    categorySlot.content[0].type === 'datetime'
      ? new Date(categoryValue)
      : categoryValue
  );

  // Use the formatters
  const formattedData = data.map(row => ({
    category: formattedCategory,
    value: measureFormatter(row[1])
  }));
}
```

### Chart styling

#### Using the dashboard or chart theme

Your custom chart can be styled dynamically based on the chart or dashboard theme configured by the user. The `options` object passed to the `render()` function always contains a `theme` property that you can use to customize the chart's appearance. 

This `theme` property is of type `ThemeConfig` (available from the `@luzmo/dashboard-contents-types` library) and contains following properties.

```typescript
interface ThemeConfig {
  axis?: Record<'fontSize', number> // Font size of the axis labels.
  background?: string; // Background color of the dashboard canvas.
  borders?: { 
    'border-color'?: string; // Color of the border
    'border-radius'?: string; // Radius of the border
    'border-style'?: string; // Style of the border
    'border-top-width'?: string; // Top width of the border
    'border-right-width'?: string; // Right width of the border
    'border-bottom-width'?: string; // Bottom width of the border
    'border-left-width'?: string; // Left width of the border
  }; // Border styling.
  boxShadow?: { 
    size?: 'S' | 'M' | 'L' | 'none'; // Size of the boxshadow.
    color?: string; // Color of the boxshadow.
  }; // Box shadow styling.
  colors?: string[]; // Custom color palette, an array of colors used when a chart needs multiple colors (e.g. donut chart).
  font?: { 
    fontFamily?: string; // Font family used in the chart.
    fontSize?: number; // Font size in px.
    'font-weight'?: number; // Font weight.
    'font-style'?: 'normal'; // Font style.
  }; // Font styling.
  itemsBackground?: string; // Background color of the chart.
  itemSpecific?: { 
    rounding?: number; // Rounding of elements in the chart.
    padding?: number; // Padding between elements in the chart.
  };
  legend?: { 
    type?: 'normal' | 'line' | 'circle'; // Display type of the legend.
    fontSize?: number; // Font size of the legend in px.
    lineHeight?: number; // Line height of the legend in px.
  }; // Legend styling, applied if a legend is displayed.
  mainColor?: string; // Main color of the theme.
  title?: { 
    align?: 'left' | 'center' | 'right'; // Alignment of the title
    bold?: boolean; // Whether the title is bold
    border?: boolean; // Whether the title has a bottom border
    fontSize?: number; // Font size of the title in px
    italic?: boolean; // Whether the title is italic
    lineHeight?: number; // Line height of the title in px
    underline?: boolean; // Whether the title is underlined
  }; // Title styling, applied if a title is displayed.
  tooltip?: { 
    fontSize?: number; // Font size of the tooltip in px
    background?: string; // Background color of the tooltip
    lineHeight?: number; // Line height of the tooltip in px
    opacity?: number; // Opacity of the tooltip
  }; // Tooltip styling, applied if a tooltip is displayed (e.g. on hover over a bar in a bar chart).
}
```

Example usage:
```typescript
import { ThemeConfig } from '@luzmo/dashboard-contents-types';

// In your chart.ts file
export function render({
  container,
  data = [],
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width = 600, height = 400 } = {}
}: ChartParams): void {
  // Extract theme from options
  const theme: ThemeConfig = options.theme;
    
  // Clear container and set background
  container.innerHTML = '';
  container.style.backgroundColor = theme.itemsBackground;

  // Create main chart container with dynamic theme properties
  const chartContainer = document.createElement('div');
  chartContainer.className = 'chart-container';
  chartContainer.style.fontFamily = theme.font?.fontFamily || 'system-ui, sans-serif';
  chartContainer.style.fontSize = (theme.font?.fontSize || 13) + 'px';

  // Add a title that uses mainColor
  const titleElement = document.createElement('h2');
  titleElement.textContent = 'Chart Title';
  titleElement.style.color = theme.mainColor;

  chartContainer.appendChild(titleElement);
}
```

#### Styling with chart.css

The `chart.css` file allows you to add custom styles to your chart elements. The CSS is bundled with your chart and isolated from the dashboard styles.

Example:

```css
.bar-chart-container {
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  text-align: center;
}

.axis path,
.axis line {
  stroke: #e0e0e0;
}

.axis text {
  font-size: 12px;
  fill: #666;
}

.bar {
  transition: opacity 0.2s;
}

.bar:hover {
  opacity: 0.8;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  margin-right: 10px;
  font-size: 12px;
}
```

Your CSS will be minified during the build process and included in the final chart package.

### Interacting with the Dashboard

Your custom chart can interact with the dashboard and other items in the dashboard by sending events to the parent window. There are three types of events you can send:

#### Filter event (`setFilter`)

Filter events allow your chart to filter data in other dashboard items. The filter structure must match the `ItemFilter` type from the `@luzmo/dashboard-contents-types` library.

```typescript
import { ItemFilter } from '@luzmo/dashboard-contents-types';

// Example of sending a filter event
function sendFilterEvent(filters: ItemFilter[]): void {
  const eventData = {
    type: 'setFilter',  // Must always be 'setFilter'
    filters: filters
  };
  
  // Post message to parent window
  window.parent.postMessage(eventData, '*');
}

// Example usage in a click handler
function onBarClick(category: string, value: number): void {
  const filters: ItemFilter[] = [
    {
      expression: '? = ?',  // Filter expression
      parameters: [
        {
          columnId: 'category-column-id',  // Column to filter on
          datasetId: 'dataset-id'          // Dataset containing the column
        },
        category  // Value to filter by
      ]
    }
  ];
  
  sendFilterEvent(filters);
}
```

The `ItemFilter` interface has the following structure:

```typescript
interface ItemFilter {
  // Filter expression from a predefined list
  expression: '? = ?' | '? != ?' | '? in ?' | '? not in ?' | '? like ?' | '? not like ?' | 
              '? starts with ?' | '? not starts with ?' | '? ends with ?' | '? not ends with ?' | 
              '? < ?' | '? <= ?' | '? > ?' | '? >= ?' | '? between ?' | '? is null' | '? is not null';
  
  // Filter parameters
  parameters: [
    {
      columnId?: string;    // Column to filter on
      datasetId?: string;   // Dataset containing the column
      level?: number;       // Optional level for hierarchical or datetime data
    },
    any                     // Value to filter by
  ];
}
```

#### Custom event (`customEvent`)

Custom events allow your chart to send any data from your chart to the dashboard for custom handling. This custom event can then further travel from the dashboard to your own application (if the dashboard is embedded), allowing you to create flexible and powerful workflows in your own application. 

The event type must always be 'customEvent', but you can include any data structure you need.

```typescript
// Example of sending a custom event
function sendCustomEvent(eventType: string, data: any): void {
  const eventData = {
    type: 'customEvent',  // Must always be 'customEvent'
    data: {
      eventType: eventType,  // Your custom event type
      ...data                // Any additional data you want to send
    }
  };
  
  // Post message to parent window
  window.parent.postMessage(eventData, '*');
}

// Example usage in a click handler
function onDataPointClick(category: string, value: number): void {
  sendCustomEvent('dataPointSelected', {
    category: category,
    value: value,
    timestamp: new Date().toISOString()
  });
}
```

#### Query loaded event (`queryLoaded`)

Notify the dashboard that the query of the custom chart has been updated by sending a `queryLoaded` event to the parent window.

The dashboard will then use the updated query to refetch the data and rerender the chart.

```typescript
window.parent.postMessage({ type: 'queryLoaded', query }, '*');
```

You can use the `buildQuery()` function to build the query. See the [Implementing your chart in chart.ts](#buildquery-function-optional) section for more information.
The query must be sent as an object of type `ItemQuery` (available from the `@luzmo/dashboard-contents-types` library).

This is useful if you want to update the query dynamically, for example if the users **sorts data** in an interactive chart or when you want to implement **pagination** in a custom table.

## Adding third party libraries

You can install and use third party libraries in your chart. Add them to the package.json file of the custom-chart project and import them in your chart.ts file to start using them.

For example, interesting libraries you can use to develop your chart are:
- D3.js
- Chart.js
- Tanstack Table
- ...

## Building and packaging

### Production package

To create a distribution-ready package that can be uploaded to Luzmo:

```bash
npm run build
```

This command:
1. Builds the chart
2. Validates the manifest.json against the schema
3. Creates a ZIP archive (bundle.zip) containing all required files, ready for upload to Luzmo

### Validation only

To validate your manifest.json without building:

```bash
npm run validate
```

## Troubleshooting

### Common issues

- **Manifest validation errors**: Check your slot configuration against the schema
- **Chart not rendering**: Verify your data structure matches what your render function expects
- **Build errors**: Check the console for detailed error messages

### Logs and debugging

- Builder logs appear with the [ANGULAR] prefix
- Bundle server logs appear with the [BUNDLE] prefix
- Chart watcher logs appear with the [WATCHER] prefix

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Resources

- [Developer Guide](https://developer.luzmo.com/guide/embedding--custom-charts)
- [Custom Charts Academy Article](https://academy.luzmo.com/article/xtau1755)
