import type { ChartDataItem } from './model';
import * as d3 from 'd3';
import { formatter } from './formatter/formatter';
import type { Slot } from '@luzmo/dashboard-contents-types';

/**
 * Generate sample data for empty state visualization
 * @param numCategories Number of categories to generate
 * @param numGroups Number of groups to generate
 * @returns Array of sample data items
 */
export function generateSampleData(
  numCategories = 5,
  numGroups = 3
): ChartDataItem[] {
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
        rawValue: rawValue // Store the raw value
      });
    }
  }

  return data;
}

/**
 * Helper function to render chart with given data and dimensions
 */
export function renderChart(
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
 * Set up chart container
 * @param container Container element
 */
export function setupContainer(container: HTMLElement): HTMLElement {
  // Clear container
  container.innerHTML = '';

  // Create chart container
  const chartContainer = document.createElement('div');
  chartContainer.className = 'bar-chart-container';
  container.appendChild(chartContainer);
  return chartContainer;
}

/**
 * Set up empty state overlay
 * @param container Container element
 */
export function setupEmptyState(container: HTMLElement): void {
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

export function preProcessData(
  data: any[][],
  measureSlot: Slot,
  groupSlot: Slot
) {
  const formatValue = measureSlot?.content[0]
    ? formatter(measureSlot.content[0])
    : (val: any) => val.toString();
  const hasGroup = groupSlot?.content?.length! > 0;

  return data.map((row) => {
    const categoryIndex = 0;
    const groupIndex = hasGroup ? 1 : -1;
    const measureIndex = hasGroup ? 2 : 1;

    // Extract data based on slot positions
    const category =
      row[categoryIndex]?.name?.en || row[categoryIndex] || 'Unknown';
    const group = hasGroup
      ? row[groupIndex]?.name?.en || row[groupIndex] || 'Default'
      : 'Default';

    // Convert value to number for calculations
    const rawValue =
      typeof row[measureIndex] === 'number'
        ? row[measureIndex]
        : Number(row[measureIndex]) || 0;

    // Format the value as a string
    const formattedValue = formatValue(rawValue);

    return {
      category: typeof category === 'string' ? category : String(category),
      group: typeof group === 'string' ? group : String(group),
      value: formattedValue, // Formatted string value
      rawValue: rawValue // Raw number for calculations
    };
  });
}
