/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  Slot,
  SlotConfig,
  ItemQueryDimension,
  ItemQueryMeasure,
  ItemQuery
} from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';
import { formatter } from '@luzmo/analytics-components-kit/utils';

// Filter related interfaces
interface ItemFilter {
  expression: '? = ?' | '? in ?';
  parameters: [
    {
      column_id?: string;
      dataset_id?: string;
      level?: number;
    },
    any
  ];
  properties?: {
    origin: 'filterFromVizItem';
    type: 'where';
    itemId?: string;
  };
}

interface ChartDataItem {
  category: string;
  group: string;
  value: number | string; // Allow string values for formatted numbers
  rawValue: number; // Store the raw numeric value for calculations
  columnId?: string; // Add columnId to track which column this data point belongs to
  datasetId?: string; // Add datasetId to track which dataset this data point belongs to
}

// Define custom event data interface
interface CustomEventData {
  type: string;
  data: {
    category: string;
    group: string;
    value: string | number;
    rawValue: number;
  };
}

interface FilterEventData {
  type: string;
  filters: ItemFilter[];
}

// State management for selected bars
interface ChartState {
  selectedBars: Set<string>; // Store unique identifiers for selected bars
  categorySlot?: Slot;
  measureSlot?: Slot;
  groupSlot?: Slot;
}

// Initialize chart state
const chartState: ChartState = {
  selectedBars: new Set()
};

/**
 * Helper function to send custom events to the parent window
 * @param eventType Type of event
 * @param data Data to send with the event
 *
 * NOTE: This is a helper method for internal use. You can implement your own event handling
 * directly in the render/resize methods if needed.
 */
function sendCustomEvent(eventType: string, data: any): void {
  const eventData: CustomEventData = {
    type: eventType,
    data
  };

  // Post message to parent window
  window.parent.postMessage(eventData, '*');
}

/**
 * Helper function to send filter events to the parent window
 * @param filters Array of filters to send
 *
 * NOTE: This is a helper method for internal use. You can implement your own filter handling
 * directly in the render/resize methods if needed.
 */
function sendFilterEvent(filters: ItemFilter[]): void {
  const eventData: FilterEventData = {
    type: 'setFilter',
    filters
  };
  window.parent.postMessage(eventData, '*');
}

// Define types for chart configuration
interface ChartDimensions {
  width: number;
  height: number;
}

// Define parameter types for render and resize functions
interface ChartParams {
  container: HTMLElement;
  data: any[][];
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any>;
  language: string;
  dimensions: ChartDimensions;
}

/**
 * Main render function for the column chart
 * @param params Chart rendering parameters
 */
export const render = ({
  container,
  data = [],
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 }
}: ChartParams): void => {
  const chartContainer = setupContainer(container);

  // Store slots in chart state
  chartState.categorySlot = slots.find((s) => s.name === 'category');
  chartState.measureSlot = slots.find((s) => s.name === 'measure');
  chartState.groupSlot = slots.find((s) => s.name === 'legend');

  // Check if we have actual data or need sample data
  const hasCategory = chartState.categorySlot?.content?.length! > 0;
  const hasMeasure = chartState.measureSlot?.content?.length! > 0;
  const isEmptyState = !data.length || !hasCategory || !hasMeasure;

  // Prepare data for visualization
  let chartData: ChartDataItem[] = [];

  if (isEmptyState) {
    // Generate sample data for empty state
    chartData = generateSampleData();
    setupEmptyState(container);
  } else {
    // Process real data
    chartData = preProcessData(
      data,
      chartState.measureSlot!,
      chartState.categorySlot!,
      chartState.groupSlot!
    );
  }

  // Set up dimensions
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Render the chart
  renderChart(
    chartContainer,
    chartData,
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    isEmptyState
  );

  // Store the chart data on the container for reference during resize
  (container as any).__chartData = chartData;
  (container as any).__isEmptyState = isEmptyState;
};

/**
 * Resize handler
 * @param params Chart resize parameters
 */
export const resize = ({
  container,
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 }
}: ChartParams): void => {
  // Get the existing state
  const chartData = (container as any).__chartData || [];
  const isEmptyState = (container as any).__isEmptyState || false;

  const newChartContainer = setupContainer(container);

  // Set up dimensions
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Render chart with existing data
  renderChart(
    newChartContainer,
    chartData,
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    isEmptyState
  );

  // Re-add empty state overlay if needed
  if (isEmptyState) {
    setupEmptyState(container);
  }

  // Maintain state for future resizes
  (container as any).__chartData = chartData;
  (container as any).__isEmptyState = isEmptyState;
};

/**
 * Build query for data retrieval
 * @param params Object containing slots and slot configurations
 * @returns Query object for data retrieval
 */
export const buildQuery = ({
  slots,
  slotConfigurations
}: {
  slots: Slot[];
  slotConfigurations: SlotConfig[];
}): ItemQuery => {
  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];

  // Add category dimension
  const categorySlot = slots.find((s) => s.name === 'category');
  if (categorySlot?.content.length! > 0) {
    const category = categorySlot!.content[0];
    dimensions.push({
      dataset_id: category.datasetId || category.set,
      column_id: category.columnId || category.column,
      level: category.level || 1
    });
  }

  // Add group by dimension (if available)
  const groupSlot = slots.find((s) => s.name === 'legend');
  if (groupSlot?.content.length! > 0) {
    const group = groupSlot!.content[0];
    dimensions.push({
      dataset_id: group.datasetId || group.set,
      column_id: group.columnId || group.column,
      level: group.level || 1
    });
  }

  // Add measure
  const measureSlot = slots.find((s) => s.name === 'measure');
  if (measureSlot?.content.length! > 0) {
    const measure = measureSlot!.content[0];

    // Handle different types of measures
    if (
      measure.aggregationFunc &&
      ['sum', 'average', 'min', 'max', 'count', 'distinct'].includes(
        measure.aggregationFunc
      )
    ) {
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
};

/**
 * Helper function to generate sample data for empty state visualization
 * @param numCategories Number of categories to generate
 * @param numGroups Number of groups to generate
 * @returns Array of sample data items
 *
 * NOTE: This is a helper method for internal use. You can implement your own empty state
 * handling directly in the render method if needed.
 */
function generateSampleData(numCategories = 5, numGroups = 3): ChartDataItem[] {
  const categories = [
    'Product A',
    'Product B',
    'Product C',
    'Product D',
    'Product E'
  ];
  const groups = ['Region 1', 'Region 2', 'Region 3'];

  const data = [];
  for (let i = 0; i < numCategories; i++) {
    for (let j = 0; j < numGroups; j++) {
      const rawValue = Math.floor(Math.random() * 800) + 200;
      data.push({
        category: categories[i],
        group: groups[j],
        value: rawValue.toString(), // Convert to string for sample data
        rawValue: rawValue, // Store the raw value
        columnId: `column_${i}_${j}`,
        datasetId: `dataset_${i}_${j}`
      });
    }
  }

  return data;
}

/**
 * Helper function to render chart with given data and dimensions
 *
 * NOTE: This is a helper method for internal use. You can implement your own chart rendering
 * logic directly in the render/resize methods if needed.
 */
function renderChart(
  chartContainer: HTMLElement,
  chartData: ChartDataItem[],
  width: number,
  height: number,
  margin: { top: number; right: number; bottom: number; left: number },
  innerWidth: number,
  innerHeight: number,
  isEmptyState: boolean = false
): void {
  // Create SVG
  const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
    .select(chartContainer)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Create chart area
  const chart = svg
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Add title
  svg
    .append('text')
    .attr('class', 'chart-title')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .text(isEmptyState ? 'Sample Column Chart' : 'Column Chart');

  // Group data by category and group
  const nestedData: d3.InternMap<string, ChartDataItem[]> = d3.group(
    chartData,
    (d) => d.category
  );

  // Get unique categories and groups
  const categories: string[] = Array.from(nestedData.keys());
  const groups: string[] = Array.from(new Set(chartData.map((d) => d.group)));

  // Create color scale
  const colorScale: d3.ScaleOrdinal<string, string> = d3
    .scaleOrdinal<string>()
    .domain(groups)
    .range(d3.schemeCategory10);

  // Create X scale
  const xScale: d3.ScaleBand<string> = d3
    .scaleBand<string>()
    .domain(categories)
    .range([0, innerWidth])
    .padding(0.2);

  // Create grouped X scale
  const groupedXScale: d3.ScaleBand<string> = d3
    .scaleBand<string>()
    .domain(groups)
    .range([0, xScale.bandwidth()])
    .padding(0.05);

  // Create Y scale - use the rawValue for scale calculations
  const maxValue: number = d3.max(chartData, (d) => d.rawValue) || 0;
  const yScale: d3.ScaleLinear<number, number> = d3
    .scaleLinear()
    .domain([0, maxValue * 1.1]) // Add 10% padding
    .range([innerHeight, 0]);

  // Create X axis
  chart
    .append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em');

  // Create Y axis
  chart.append('g').attr('class', 'axis y-axis').call(d3.axisLeft(yScale));

  // Create tooltip
  const tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> = d3
    .select(chartContainer)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // Create bars
  categories.forEach((category) => {
    const categoryData = chartData.filter((d) => d.category === category);

    groups.forEach((group) => {
      const groupData = categoryData.filter((d) => d.group === group);
      if (groupData.length) {
        chart
          .append('rect')
          .attr('class', 'bar')
          .attr('x', xScale(category)! + groupedXScale(group)!)
          .attr('y', yScale(groupData[0].rawValue)) // Use raw value for positioning
          .attr('width', groupedXScale.bandwidth())
          .attr('height', innerHeight - yScale(groupData[0].rawValue)) // Use raw value for height
          .attr('fill', colorScale(group))
          .on('mouseover', function (event: MouseEvent) {
            d3.select(this).transition().duration(200).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 0.9);
            tooltip
              .html(`${category}<br>${group}<br>Value: ${groupData[0].value}`) // Display formatted value
              .style('left', event.offsetX + 10 + 'px')
              .style('top', event.offsetY - 28 + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).transition().duration(200).attr('opacity', 1);
            tooltip.transition().duration(500).style('opacity', 0);
          })
          .on('click', function (event: MouseEvent) {
            // Create unique identifier for this bar
            const barId = `${category}-${group}`;

            // Toggle selection state
            if (chartState.selectedBars.has(barId)) {
              // Remove selection
              chartState.selectedBars.delete(barId);
              d3.select(this).classed('bar-selected', false);
            } else {
              // Add selection
              chartState.selectedBars.add(barId);
              d3.select(this).classed('bar-selected', true);
            }

            // Show/hide clear filter button based on selection state
            const clearFilterBtn = d3
              .select(chartContainer)
              .select('.clear-filter-btn');
            clearFilterBtn.classed('visible', chartState.selectedBars.size > 0);

            // Create filters array based on selected bars
            const filters: ItemFilter[] = [];

            // Group selected bars by columnId and datasetId
            const groupedFilters = new Map<string, Set<string>>();

            Array.from(chartState.selectedBars).forEach((barId) => {
              const [cat, grp] = barId.split('-');
              const categoryContent = chartState.categorySlot?.content[0];
              const key = `${categoryContent?.columnId || categoryContent?.column}:${categoryContent?.datasetId || categoryContent?.set}`;

              if (!groupedFilters.has(key)) {
                groupedFilters.set(key, new Set());
              }
              groupedFilters.get(key)?.add(cat);
            });

            // Create filters from grouped data
            groupedFilters.forEach((values, key) => {
              const [columnId, datasetId] = key.split(':');
              const uniqueValues = Array.from(values);

              filters.push({
                expression: uniqueValues.length > 1 ? '? in ?' : '? = ?',
                parameters: [
                  {
                    column_id: columnId,
                    dataset_id: datasetId,
                    level:
                      chartState.categorySlot?.content[0]?.level || undefined
                  },
                  uniqueValues.length > 1 ? uniqueValues : uniqueValues[0]
                ],
                properties: {
                  origin: 'filterFromVizItem',
                  type: 'where'
                }
              });
            });

            // Send setFilter event
            sendFilterEvent(filters);

            sendCustomEvent('customEvent', {
              category: category,
              group: group,
              value: groupData[0].value,
              rawValue: groupData[0].rawValue
            });
          });
      }
    });
  });

  // Add Legend
  const legend = svg
    .append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${margin.left}, ${height - 25})`);

  groups.forEach((group, i) => {
    const legendItem = legend
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', `translate(${i * 100}, 0)`);

    legendItem
      .append('rect')
      .attr('class', 'legend-color')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', colorScale(group));

    legendItem
      .append('text')
      .attr('x', 18)
      .attr('y', 10)
      .text(group)
      .style('font-size', '12px');
  });
}

/**
 * Helper function to set up chart container
 * @param container Container element
 *
 * NOTE: This is a helper method for internal use. You can implement your own container setup
 * directly in the render/resize methods if needed.
 */
function setupContainer(container: HTMLElement): HTMLElement {
  // Clear container
  container.innerHTML = '';

  // Create chart container
  const chartContainer = document.createElement('div');
  chartContainer.className = 'bar-chart-container';
  container.appendChild(chartContainer);

  // Add clear filter button
  const clearFilterBtn = document.createElement('button');
  clearFilterBtn.className = 'clear-filter-btn';
  clearFilterBtn.textContent = 'Clear Filters';
  clearFilterBtn.onclick = () => {
    // Clear all selected bars
    chartState.selectedBars.clear();
    // Remove selected class from all bars
    d3.selectAll('.bar').classed('bar-selected', false);
    // Hide clear filter button
    clearFilterBtn.classList.remove('visible');
    // Send empty filters array to clear filters
    sendFilterEvent([]);
  };
  chartContainer.appendChild(clearFilterBtn);

  return chartContainer;
}

/**
 * Helper function to set up empty state overlay
 * @param container Container element
 *
 * NOTE: This is a helper method for internal use. You can implement your own empty state
 * handling directly in the render method if needed.
 */
function setupEmptyState(container: HTMLElement): void {
  // Add empty state overlay
  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';
  emptyState.innerHTML = `
    <div class="empty-state-icon">📊</div>
    <div class="empty-state-title">No Data Available</div>
    <div class="empty-state-message">
      Add data to the Category and Measure slots to create your visualization.
    </div>
  `;
  container.appendChild(emptyState);
}

/**
 * Helper function to preprocess data for visualization
 * @param data Raw data array
 * @param measureSlot Measure slot configuration
 * @param categorySlot Category slot configuration
 * @param groupSlot Group slot configuration
 * @returns Processed data array
 *
 * NOTE: This is a helper method for internal use. You can implement your own data processing
 * directly in the render method if needed.
 */
function preProcessData(
  data: any[][],
  measureSlot: Slot,
  categorySlot: Slot,
  groupSlot: Slot
): ChartDataItem[] {
  // Create formatters for each slot
  const formatters = {
    category: categorySlot?.content[0]
      ? formatter(categorySlot.content[0], {
          level: categorySlot.content[0].level || 9
        })
      : (val: any) => String(val),
    group: groupSlot?.content[0]
      ? formatter(groupSlot.content[0], {
          level: groupSlot.content[0].level || 9
        })
      : (val: any) => String(val),
    measure: measureSlot?.content[0]
      ? formatter(measureSlot.content[0])
      : (val: any) => String(val)
  };

  const hasGroup = groupSlot?.content?.length! > 0;
  const indices = {
    category: 0,
    group: hasGroup ? 1 : -1,
    measure: hasGroup ? 2 : 1
  };

  return data.map((row) => {
    // Extract and format values
    const categoryValue =
      row[indices.category]?.name?.en || row[indices.category] || 'Unknown';
    const category = formatters.category(
      categorySlot.content[0].type === 'datetime'
        ? new Date(categoryValue)
        : categoryValue
    );

    const groupValue =
      row[indices.group]?.name?.en || row[indices.group] || 'Default';
    const group = hasGroup
      ? formatters.group(
          groupSlot.content[0].type === 'datetime'
            ? new Date(groupValue)
            : groupValue
        )
      : 'Default';

    const rawValue = Number(row[indices.measure]) || 0;
    const formattedValue = formatters.measure(rawValue);

    return {
      category: String(category),
      group: String(group),
      value: formattedValue,
      rawValue,
      columnId: row[indices.measure]?.columnId,
      datasetId: row[indices.measure]?.datasetId
    };
  });
}
