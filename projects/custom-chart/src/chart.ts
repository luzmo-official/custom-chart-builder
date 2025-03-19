import { Slot, SlotConfig, ItemQueryDimension, ItemQueryMeasure, ItemQuery } from '@luzmo/dashboard-contents-types';
import { ChartDataItem, ChartParams } from './utils/model'
import { generateSampleData, preProcessData, renderChart, setupContainer, setupEmptyState } from './utils/chart.utils';

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
  dimensions: { width, height } = { width: 0, height: 0 },
}: ChartParams): void => {
  const chartContainer = setupContainer(container);
  // Check if we have actual data or need sample data
  const categorySlot = slots.find(s => s.name === 'category');
  const measureSlot = slots.find(s => s.name === 'measure');
  
  const hasCategory = categorySlot?.content?.length! > 0;
  const hasMeasure = measureSlot?.content?.length! > 0;
  const isEmptyState = !data.length || !hasCategory || !hasMeasure;
  
  // Prepare data for visualization
  let chartData: ChartDataItem[] = [];
  
  if (isEmptyState) {
    // Generate sample data for empty state
    chartData = generateSampleData();
    setupEmptyState(container);
  } else {
    // Process real data
    const groupSlot = slots.find(s => s.name === 'legend');
    chartData = preProcessData(data, measureSlot!, groupSlot!);
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
  
  const newChartContainer = setupContainer(container);
  
  // Set up dimensions
  const margin = { top: 40, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  
  // Render chart with existing data
  renderChart(newChartContainer, chartData, width, height, margin, innerWidth, innerHeight, isEmptyState);
  
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
