import { Slot, SlotConfig, ItemQueryDimension, ItemQueryMeasure, ItemQuery } from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';

// Define types for chart data
interface ChartDataItem {
  category: string;
  group: string;
  value: number;
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
 * Generate sample data for empty state visualization
 * @param numCategories Number of categories to generate
 * @param numGroups Number of groups to generate
 * @returns Array of sample data items
 */
function generateSampleData(numCategories = 5, numGroups = 3): ChartDataItem[] {
  const categories = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'];
  const groups = ['Region 1', 'Region 2', 'Region 3'];
  
  const data = [];
  for (let i = 0; i < numCategories; i++) {
    for (let j = 0; j < numGroups; j++) {
      data.push({
        category: categories[i],
        group: groups[j],
        value: Math.floor(Math.random() * 800) + 200
      });
    }
  }
  
  return data;
}

/**
 * Helper function to render chart with given data and dimensions
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
  const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3.select(chartContainer)
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // Create chart area
  const chart = svg.append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Add title
  svg.append('text')
    .attr('class', 'chart-title')
    .attr('x', width / 2)
    .attr('y', 20)
    .attr('text-anchor', 'middle')
    .text(isEmptyState ? 'Sample Bar Chart' : 'Bar Chart');

  // Group data by category and group
  const nestedData: d3.InternMap<string, ChartDataItem[]> = d3.group(chartData, d => d.category);
  
  // Get unique categories and groups
  const categories: string[] = Array.from(nestedData.keys());
  const groups: string[] = Array.from(new Set(chartData.map(d => d.group)));

  // Create color scale
  const colorScale: d3.ScaleOrdinal<string, string> = d3.scaleOrdinal<string>()
    .domain(groups)
    .range(d3.schemeCategory10);

  // Create X scale
  const xScale: d3.ScaleBand<string> = d3.scaleBand<string>()
    .domain(categories)
    .range([0, innerWidth])
    .padding(0.2);

  // Create grouped X scale
  const groupedXScale: d3.ScaleBand<string> = d3.scaleBand<string>()
    .domain(groups)
    .range([0, xScale.bandwidth()])
    .padding(0.05);

  // Create Y scale
  const maxValue: number = d3.max(chartData, d => d.value) || 0;
  const yScale: d3.ScaleLinear<number, number> = d3.scaleLinear()
    .domain([0, maxValue * 1.1]) // Add 10% padding
    .range([innerHeight, 0]);

  // Create X axis
  chart.append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em');

  // Create Y axis
  chart.append('g')
    .attr('class', 'axis y-axis')
    .call(d3.axisLeft(yScale));

  // Create tooltip
  const tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> = d3.select(chartContainer)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);

  // Create bars
  categories.forEach(category => {
    const categoryData = chartData.filter(d => d.category === category);
    
    groups.forEach(group => {
      const groupData = categoryData.filter(d => d.group === group);
      if (groupData.length) {
        chart.append('rect')
          .attr('class', 'bar')
          .attr('x', xScale(category)! + groupedXScale(group)!)
          .attr('y', yScale(groupData[0].value))
          .attr('width', groupedXScale.bandwidth())
          .attr('height', innerHeight - yScale(groupData[0].value))
          .attr('fill', colorScale(group))
          .on('mouseover', function(event: MouseEvent) {
            d3.select(this).transition().duration(200).attr('opacity', 0.8);
            tooltip.transition().duration(200).style('opacity', 0.9);
            tooltip.html(`${category}<br>${group}<br>Value: ${groupData[0].value}`)
              .style('left', (event.offsetX + 10) + 'px')
              .style('top', (event.offsetY - 28) + 'px');
          })
          .on('mouseout', function() {
            d3.select(this).transition().duration(200).attr('opacity', 1);
            tooltip.transition().duration(500).style('opacity', 0);
          });
      }
    });
  });

  // Add Legend
  const legend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${margin.left}, ${height - 25})`);

  groups.forEach((group, i) => {
    const legendItem = legend.append('g')
      .attr('class', 'legend-item')
      .attr('transform', `translate(${i * 100}, 0)`);
    
    legendItem.append('rect')
      .attr('class', 'legend-color')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', colorScale(group));
    
    legendItem.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .text(group)
      .style('font-size', '12px');
  });
}

/**
 * Main render function for the bar chart
 * @param params Chart rendering parameters
 */
export const render = ({
  container,
  data = [],
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 },
}: ChartParams): void => {
  // Clear container
  container.innerHTML = '';
  
  // Create chart container
  const chartContainer = document.createElement('div');
  chartContainer.className = 'bar-chart-container';
  container.appendChild(chartContainer);

  // Check if we have actual data or need sample data
  const categorySlot = slots.find(s => s.name === 'category');
  const measureSlot = slots.find(s => s.name === 'measure');
  
  const hasCategory = categorySlot?.content?.length! > 0;
  const hasMeasure = measureSlot?.content?.length! > 0;
  const isEmptyState = !data.length || !hasCategory || !hasMeasure;
  
  // Prepare data for visualization
  let chartData: ChartDataItem[] = [];

  console.log('Is in empty state..?', isEmptyState);
  
  if (isEmptyState) {
    // Generate sample data for empty state
    chartData = generateSampleData();
    
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
  } else {
    // Process real data
    const groupSlot = slots.find(s => s.name === 'legend');
    const hasGroup = groupSlot?.content?.length! > 0;
    
    // Transform data into the format we need
    chartData = data.map(row => {
      const categoryIndex = 0;
      const groupIndex = hasGroup ? 1 : -1;
      const measureIndex = hasGroup ? 2 : 1;
      
      // Extract data based on slot positions
      const category = row[categoryIndex]?.name?.en || row[categoryIndex] || 'Unknown';
      const group = hasGroup 
        ? (row[groupIndex]?.name?.en || row[groupIndex] || 'Default') 
        : 'Default';
      const value = row[measureIndex] || 0;
      
      return {
        category: typeof category === 'string' ? category : String(category),
        group: typeof group === 'string' ? group : String(group),
        value: typeof value === 'number' ? value : Number(value) || 0
      };
    });
  }

  // Set up dimensions
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Render the chart
  renderChart(chartContainer, chartData, width, height, margin, innerWidth, innerHeight, isEmptyState);

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
  dimensions: { width, height } = { width: 0, height: 0 },
}: ChartParams): void => {
  // Get the existing state
  const chartData = (container as any).__chartData || [];
  const isEmptyState = (container as any).__isEmptyState || false;
  
  // Clear container but preserve data
  container.innerHTML = '';
  
  // Create new chart container
  const newChartContainer = document.createElement('div');
  newChartContainer.className = 'bar-chart-container';
  container.appendChild(newChartContainer);
  
  // Set up dimensions
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Render chart with existing data
  renderChart(newChartContainer, chartData, width, height, margin, innerWidth, innerHeight, isEmptyState);
  
  // Re-add empty state overlay if needed
  if (isEmptyState) {
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
  slots: Slot[], 
  slotConfigurations: SlotConfig[] 
}): ItemQuery => {
  const dimensions: ItemQueryDimension[] = [];
  const measures: ItemQueryMeasure[] = [];
  
  // Add category dimension
  const categorySlot = slots.find(s => s.name === 'category');
  if (categorySlot?.content.length! > 0) {
    const category = categorySlot!.content[0];
    dimensions.push({
      dataset_id: category.datasetId || category.set,
      column_id: category.columnId || category.column,
      level: category.level || 1
    });
  }
  
  // Add group by dimension (if available)
  const groupSlot = slots.find(s => s.name === 'legend');
  if (groupSlot?.content.length! > 0) {
    const group = groupSlot!.content[0];
    dimensions.push({
      dataset_id: group.datasetId || group.set,
      column_id: group.columnId || group.column,
      level: group.level || 1
    });
  }
  
  // Add measure
  const measureSlot = slots.find(s => s.name === 'measure');
  if (measureSlot?.content.length! > 0) {
    const measure = measureSlot!.content[0];
    
    // Handle different types of measures
    if (measure.aggregationFunc && ['sum', 'average', 'min', 'max', 'count', 'distinct'].includes(measure.aggregationFunc)) {
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
