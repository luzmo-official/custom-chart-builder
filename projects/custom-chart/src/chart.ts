import { formatter } from '@luzmo/analytics-components-kit/utils';
import type {
  ItemData,
  ItemFilter,
  ItemThemeConfig,
  Slot,
  SlotConfig
} from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';

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

interface ThemeContext {
  backgroundColor: string;
  axisTextColor: string;
  axisLineColor: string;
  fontFamily: string;
  basePalette: string[];
  mainColor: string;
  barRounding: number;
  barPadding: number;
  hoverShadow: string;
  selectedShadow: string;
  tooltipBackground: string;
  tooltipColor: string;
  controlBackground: string;
  controlBorder: string;
  controlText: string;
  controlHoverBackground: string;
}

function toRgb(color?: string, fallback = '#ffffff'): d3.RGBColor {
  const parsed = d3.color(color ?? fallback) ?? d3.color(fallback);
  return d3.rgb(parsed?.toString() ?? fallback);
}

function getRelativeLuminance(color: d3.RGBColor): number {
  const normalize = (value: number) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };

  return 0.2126 * normalize(color.r) + 0.7152 * normalize(color.g) + 0.0722 * normalize(color.b);
}

function lightenColor(color: string, amount = 0.2): string {
  const parsed = d3.color(color);
  if (!parsed) {
    return color;
  }
  const interpolator = d3.interpolateRgb(parsed, '#ffffff');
  return interpolator(Math.min(1, Math.max(0, amount)));
}

function darkenColor(color: string, amount = 0.2): string {
  const parsed = d3.color(color);
  if (!parsed) {
    return color;
  }
  const interpolator = d3.interpolateRgb(parsed, '#000000');
  return interpolator(Math.min(1, Math.max(0, amount)));
}

function expandPalette(basePalette: string[], mainColor: string, length: number): string[] {
  if (length <= basePalette.length) {
    return basePalette.slice(0, length);
  }

  const palette = [...basePalette];
  const modifiers = [0.15, -0.15, 0.3, -0.3, 0.45, -0.45, 0.6, -0.6];
  let index = 0;

  while (palette.length < length) {
    const modifier = modifiers[index % modifiers.length];
    const intensity = Math.min(0.85, Math.abs(modifier));
    const color = modifier >= 0 ? lightenColor(mainColor, intensity) : darkenColor(mainColor, intensity);
    palette.push(color);
    index++;
  }

  return palette.slice(0, length);
}

function resolveTheme(theme?: ItemThemeConfig): ThemeContext {
  const backgroundColor = theme?.itemsBackground || '#ffffff';
  const backgroundRgb = toRgb(backgroundColor);
  const luminance = getRelativeLuminance(backgroundRgb);
  const axisTextColor = luminance < 0.45 ? '#f8fafc' : '#1f2937';
  const axisLineReference =
    luminance < 0.45 ? lightenColor(backgroundColor, 0.25) : darkenColor(backgroundColor, 0.15);
  const axisLineColor = d3.color(axisLineReference)?.formatHex() ?? '#d1d5db';

  const paletteFromTheme = (theme?.colors ?? []).filter(Boolean) as string[];
  const mainColor = theme?.mainColor || paletteFromTheme[0];

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  const barRounding = Math.max(2, Math.min(16, theme?.itemSpecific?.rounding ?? 8));
  const paddingSetting = theme?.itemSpecific?.padding;
  const barPadding =
    typeof paddingSetting === 'number'
      ? Math.max(0.05, Math.min(0.35, paddingSetting / 100))
      : 0.18;

  const hoverShadowBase = d3.color(darkenColor(mainColor, 0.55)) ?? d3.rgb(15, 23, 42);
  const selectedShadowBase = d3.color(mainColor) ?? d3.rgb(99, 102, 241);
  const hoverShadow = `rgba(${hoverShadowBase.r}, ${hoverShadowBase.g}, ${hoverShadowBase.b}, ${luminance < 0.45 ? 0.55 : 0.25
    })`;
  const selectedShadow = `rgba(${selectedShadowBase.r}, ${selectedShadowBase.g}, ${selectedShadowBase.b}, ${luminance < 0.45 ? 0.55 : 0.35
    })`;

  const tooltipBaseColor = theme?.tooltip?.background ||
    (luminance < 0.45 ? lightenColor(backgroundColor, 0.18) : darkenColor(backgroundColor, 0.35));
  const tooltipColorRgb = toRgb(tooltipBaseColor);
  const tooltipBackground = `rgba(${tooltipColorRgb.r}, ${tooltipColorRgb.g}, ${tooltipColorRgb.b}, 0.70)`;
  const tooltipColor = luminance < 0.45 ? '#0f172a' : '#f8fafc';

  const controlBase =
    luminance < 0.45 ? lightenColor(backgroundColor, 0.22) : darkenColor(backgroundColor, 0.08);
  const controlBackground = controlBase;
  const controlBorder =
    luminance < 0.45 ? lightenColor(controlBase, 0.12) : darkenColor(controlBase, 0.12);
  const controlHoverBackground =
    luminance < 0.45 ? lightenColor(controlBase, 0.18) : darkenColor(controlBase, 0.18);
  const controlText = axisTextColor;

  return {
    backgroundColor,
    axisTextColor,
    axisLineColor,
    fontFamily,
    basePalette: paletteFromTheme,
    mainColor,
    barRounding,
    barPadding,
    hoverShadow,
    selectedShadow,
    tooltipBackground,
    tooltipColor,
    controlBackground,
    controlBorder,
    controlText,
    controlHoverBackground
  };
}


/**
 * Helper function to send custom events to the parent window
 * @param eventType Type of event
 * @param data Data to send with the event
 *
 * NOTE: This is a helper method for internal use. You can implement your own event handling
 * directly in the render/resize methods if needed.
 */
function sendCustomEvent(data: any): void {
  const eventData: CustomEventData = {
    type: 'customEvent',
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

  // Post message to parent window
  window.parent.postMessage(eventData, '*');
}

// Define parameter types for render and resize functions
interface ChartParams {
  container: HTMLElement;
  data: ItemData['data'];
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any> & { theme?: ItemThemeConfig };
  language: string;
  dimensions: { width: number; height: number };
}

/**
 * Calculate the height needed for the legend based on number of items and available width
 * @param groups Array of group names
 * @param totalWidth Total width available for the chart
 * @returns Height needed for the legend
 */
function calculateLegendHeight(groups: string[], totalWidth: number): number {
  const itemWidth = 140; // Width per legend item including spacing
  const rowHeight = 24; // Height per row including spacing
  const leftMargin = 60; // Chart left margin
  const rightMargin = 30; // Chart right margin
  const availableWidth = totalWidth - leftMargin - rightMargin;
  
  const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth));
  const numberOfRows = Math.ceil(groups.length / itemsPerRow);
  
  return numberOfRows * rowHeight;
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
  const themeContext = resolveTheme(options.theme);
  (container as any).__themeContext = themeContext;
  const chartContainer = setupContainer(container, themeContext);

  // Store slots in chart state
  chartState.categorySlot = slots.find((s) => s.name === 'category');
  chartState.measureSlot = slots.find((s) => s.name === 'measure');
  chartState.groupSlot = slots.find((s) => s.name === 'legend');

  const measureFormatterFn =
    chartState.measureSlot?.content?.[0]
      ? formatter(chartState.measureSlot.content[0])
      : (value: number) => new Intl.NumberFormat(language).format(value);

  const hasCategory = chartState.categorySlot?.content?.length! > 0;
  const hasMeasure = chartState.measureSlot?.content?.length! > 0;

  // Prepare data for visualization
  let chartData: ChartDataItem[] = [];

  // Check if we have actual data or need sample data
  if (!data.length || !hasCategory || !hasMeasure) {
    // Generate sample data for empty state
    const categories = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'];
    const groups = ['Region 1', 'Region 2', 'Region 3'];
    const sampleData = [];

    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < groups.length; j++) {
        const rawValue = Math.floor(Math.random() * 800) + 200;
        sampleData.push({
          category: categories[i],
          group: groups[j],
          value: measureFormatterFn(rawValue), // Format sample data using measure formatter
          rawValue: rawValue, // Store the raw value
          columnId: `column_${i}_${j}`,
          datasetId: `dataset_${i}_${j}`
        });
      }
    }

    chartData = sampleData;
  }
  else {
    // Process real data
    chartData = preProcessData(
      data,
      chartState.measureSlot!,
      chartState.categorySlot!,
      chartState.groupSlot!,
      measureFormatterFn
    );
  }

  // Calculate legend height first to adjust margins
  const groups: string[] = Array.from(new Set(chartData.map((d) => d.group)));
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');
  const legendHeight = hasMultipleGroups ? calculateLegendHeight(groups, width) : 0;

  // Set up dimensions with dynamic top margin based on legend height
  const margin = { top: 40 + legendHeight, right: 30, bottom: 60, left: 60 };
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
    themeContext,
    measureFormatterFn
  );

  // Store the chart data on the container for reference during resize
  (container as any).__chartData = chartData;
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
  const previousThemeContext = (container as any).__themeContext as ThemeContext | undefined;
  const themeContext = options.theme ? resolveTheme(options.theme) : previousThemeContext ?? resolveTheme(undefined);
  (container as any).__themeContext = themeContext;
  const measureFormatterFn = chartState.measureSlot?.content?.[0]
    ? formatter(chartState.measureSlot.content[0])
    : (value: number) => new Intl.NumberFormat(language).format(value);
  const newChartContainer = setupContainer(container, themeContext);

  // Calculate legend height first to adjust margins
  const groups: string[] = Array.from(new Set(chartData.map((d) => d.group)));
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');
  const legendHeight = hasMultipleGroups ? calculateLegendHeight(groups, width) : 0;

  // Set up dimensions with dynamic top margin based on legend height
  const margin = { top: 40 + legendHeight, right: 30, bottom: 60, left: 60 };
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
    themeContext,
    measureFormatterFn
  );

  // Maintain state for future resizes
  (container as any).__chartData = chartData;
};

/**
 * Build query for data retrieval
 * NOTE: This method is OPTIONAL to implement. If not implemented, Luzmo will automatically build a query based on the slot configurations. For more advanced use cases, you can implement this method to build a custom query (e.g. if you need your query to return row-level data instead of aggregated data, or if you want to implement ordering or pagination in your chart).
 * 
 * See the README.md file for more information on how to implement this method and expected query structure.
 * 
 * @param params Object containing slots with their contents and slot configurations.
 * @returns Query object for data retrieval
 */
/*
export const buildQuery = ({
  slots = [],
  slotConfigurations = []
}: {
  slots: Slot[];
  slotConfigurations: SlotConfig[];
}): ItemQuery => {
  return {
    dimensions: [],
    measures: [],
    order: [],
    limit: { by: 10000, offset: 0 }
  };
};
*/

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
  theme: ThemeContext,
  measureFormatter: (value: number) => string
): void {
  const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> = d3
    .select(chartContainer)
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('class', 'bar-chart-svg');

  if (theme.fontFamily) {
    svg.style('font-family', theme.fontFamily);
  }

  const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const nestedData = d3.group(chartData, (d) => d.category);
  const categories: string[] = Array.from(nestedData.keys());
  const groups: string[] = Array.from(new Set(chartData.map((d) => d.group)));

  const palette = expandPalette(theme.basePalette, theme.mainColor, Math.max(groups.length, 1));
  const colorScale: d3.ScaleOrdinal<string, string> = d3
    .scaleOrdinal<string>()
    .domain(groups)
    .range(palette);

  const xScale: d3.ScaleBand<string> = d3
    .scaleBand<string>()
    .domain(categories)
    .range([0, innerWidth])
    .padding(theme.barPadding);

  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');

  const groupedXScale: d3.ScaleBand<string> = d3
    .scaleBand<string>()
    .domain(groups)
    .range([0, Math.max(xScale.bandwidth(), 0)])
    .padding(hasMultipleGroups ? Math.min(0.35, theme.barPadding * 0.6) : 0.08);

  const baseBarWidth = hasMultipleGroups ? groupedXScale.bandwidth() : xScale.bandwidth();
  const barRadius = Math.min(theme.barRounding, Math.max(baseBarWidth, 0) / 2);

  const maxValue: number = d3.max(chartData, (d) => d.rawValue) || 0;
  const yScale: d3.ScaleLinear<number, number> = d3
    .scaleLinear()
    .domain([0, maxValue === 0 ? 1 : maxValue * 1.1])
    .range([innerHeight, 0])
    .nice();

  const xAxis = chart
    .append('g')
    .attr('class', 'axis x-axis')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale).tickSizeOuter(0));

  xAxis
    .selectAll<SVGTextElement, string>('text')
    .attr('transform', 'rotate(-45)')
    .style('text-anchor', 'end')
    .attr('dx', '-.8em')
    .attr('dy', '.15em')
    .style('fill', theme.axisTextColor);

  if (theme.fontFamily) {
    xAxis.selectAll<SVGTextElement, string>('text').style('font-family', theme.fontFamily);
  }

  xAxis.selectAll<SVGLineElement, unknown>('line').attr('stroke', theme.axisLineColor);
  xAxis.selectAll<SVGPathElement, unknown>('path').attr('stroke', theme.axisLineColor);

  const yAxisGenerator = d3
    .axisLeft(yScale)
    .ticks(6)
    .tickSize(-innerWidth)
    .tickSizeOuter(0)
    .tickFormat((value) => measureFormatter(Number(value)));
  const yAxis = chart.append('g').attr('class', 'axis y-axis').call(yAxisGenerator);

  yAxis.selectAll<SVGTextElement, number>('text').style('fill', theme.axisTextColor);

  if (theme.fontFamily) {
    yAxis.selectAll<SVGTextElement, number>('text').style('font-family', theme.fontFamily);
  }

  yAxis
    .selectAll<SVGLineElement, number>('line')
    .attr('stroke', theme.axisLineColor)
    .attr('stroke-dasharray', '2,4');
  yAxis.selectAll<SVGPathElement, unknown>('path').attr('stroke', theme.axisLineColor);

  const tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> = d3
    .select(chartContainer)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('background-color', theme.tooltipBackground)
    .style('color', theme.tooltipColor)
    .style('box-shadow', `0 12px 24px ${theme.hoverShadow}`);

  categories.forEach((category) => {
    const categoryData = chartData.filter((d) => d.category === category);

    groups.forEach((group) => {
      const datum = categoryData.find((d) => d.group === group);
      if (!datum) {
        return;
      }

      const barId = `${category}-${group}`;
      const baseFill = colorScale(group);
      const xPosition = (xScale(category) ?? 0) + (hasMultipleGroups ? groupedXScale(group) ?? 0 : 0);
      const barWidth = hasMultipleGroups ? groupedXScale.bandwidth() : xScale.bandwidth();
      const barHeight = innerHeight - yScale(datum.rawValue);

      const bar = chart
        .append('rect')
        .attr('class', 'bar')
        .attr('data-bar-id', barId)
        .attr('data-base-fill', baseFill)
        .attr('x', xPosition)
        .attr('y', yScale(datum.rawValue))
        .attr('width', barWidth)
        .attr('height', barHeight)
        .attr('fill', baseFill)
        .attr('rx', barRadius)
        .attr('ry', barRadius);

      bar
        .on('mouseover', function (event: MouseEvent) {
          const selection = d3.select(this as SVGRectElement);
          const startingFill = selection.attr('data-base-fill') || baseFill;
          const hoverFill = lightenColor(startingFill, 0.18);

          selection
            .raise()
            .attr('fill', hoverFill)
            .style('filter', `drop-shadow(0 12px 20px ${theme.hoverShadow})`);

          // Calculate tooltip position based on cursor location
          // If cursor is in right half (50-100%), position tooltip to the left
          // If cursor is in left half (0-50%), position tooltip to the right
          const halfWidth = width / 2;
          const tooltipOffset = 16;
          const estimatedTooltipWidth = 200; // Estimated tooltip width
          
          const isRightHalf = event.offsetX >= halfWidth;
          const tooltipLeft = isRightHalf 
            ? Math.max(0, event.offsetX - estimatedTooltipWidth - tooltipOffset)
            : event.offsetX + tooltipOffset;

          tooltip
            .interrupt()
            .style('opacity', 1)
            .html(
              `<div class="tooltip-title">${category}</div><div class="tooltip-row"><span>${group}</span><span>${datum.value}</span></div>`
            )
            .style('left', `${tooltipLeft}px`)
            .style('top', `${Math.max(0, event.offsetY - 56)}px`);
        })
        .on('mouseout', function () {
          const selection = d3.select(this as SVGRectElement);
          const startingFill = selection.attr('data-base-fill') || baseFill;
          const barKey = selection.attr('data-bar-id');
          const isSelected = barKey ? chartState.selectedBars.has(barKey) : false;

          if (isSelected) {
            selection
              .attr('fill', lightenColor(startingFill, 0.25))
              .style('filter', `drop-shadow(0 18px 32px ${theme.selectedShadow})`);
          } else {
            selection
              .attr('fill', startingFill)
              .style('filter', 'none');
          }

          tooltip.transition().duration(120).style('opacity', 0);
        })
        .on('click', function (event: MouseEvent) {
          event.stopPropagation();
          const selection = d3.select(this as SVGRectElement);
          const base = selection.attr('data-base-fill') || baseFill;

          if (chartState.selectedBars.has(barId)) {
            chartState.selectedBars.delete(barId);
          } else {
            chartState.selectedBars.add(barId);
          }

          const isSelectedNow = chartState.selectedBars.has(barId);

          if (isSelectedNow) {
            selection
              .classed('bar-selected', true)
              .attr('fill', lightenColor(base, 0.25))
              .attr('stroke', theme.axisTextColor)
              .attr('stroke-width', 1.25)
              .style('filter', `drop-shadow(0 20px 36px ${theme.selectedShadow})`);
          } else {
            selection
              .classed('bar-selected', false)
              .attr('fill', base)
              .attr('stroke', 'none')
              .attr('stroke-width', 0)
              .style('filter', 'none');
          }

          const clearFilterBtn = d3.select(chartContainer).select<HTMLButtonElement>('.clear-filter-btn');
          clearFilterBtn.classed('visible', chartState.selectedBars.size > 0);

          const filters: ItemFilter[] = [];
          const groupedFilters = new Map<string, Set<string>>();

          Array.from(chartState.selectedBars).forEach((selectedId) => {
            const [selectedCategory] = selectedId.split('-');
            const categoryContent = chartState.categorySlot?.content[0];
            if (!categoryContent) {
              return;
            }
            const columnKey = `${categoryContent.columnId || (categoryContent as any).column}:${categoryContent.datasetId || (categoryContent as any).set
              }`;
            if (!groupedFilters.has(columnKey)) {
              groupedFilters.set(columnKey, new Set());
            }
            groupedFilters.get(columnKey)?.add(selectedCategory);
          });

          groupedFilters.forEach((values, key) => {
            const [columnId, datasetId] = key.split(':');
            const uniqueValues = Array.from(values);

            filters.push({
              expression: uniqueValues.length > 1 ? '? in ?' : '? = ?',
              parameters: [
                {
                  column_id: columnId,
                  dataset_id: datasetId,
                  level: chartState.categorySlot?.content[0]?.level || undefined
                },
                uniqueValues.length > 1 ? uniqueValues : uniqueValues[0]
              ],
              properties: {
                origin: 'filterFromVizItem',
                type: 'where'
              }
            });
          });

          sendFilterEvent(filters);

          sendCustomEvent({
            category,
            group,
            value: datum.value,
            rawValue: datum.rawValue
          });
        });
    });
  });

  const shouldRenderLegend = hasMultipleGroups;

  if (shouldRenderLegend) {
    const itemWidth = 140; // Width per legend item including spacing
    const rowHeight = 24; // Height per row including spacing
    const availableWidth = innerWidth;
    const itemsPerRow = Math.max(1, Math.floor(availableWidth / itemWidth));

    const legend = svg
      .append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${margin.left}, ${Math.max(16, 20)})`);

    groups.forEach((group, index) => {
      const row = Math.floor(index / itemsPerRow);
      const col = index % itemsPerRow;
      
      const legendItem = legend
        .append('g')
        .attr('class', 'legend-item')
        .attr('transform', `translate(${col * itemWidth}, ${row * rowHeight})`);

      legendItem
        .append('rect')
        .attr('class', 'legend-color')
        .attr('x', 0)
        .attr('y', -9)
        .attr('width', 14)
        .attr('height', 14)
        .attr('rx', Math.max(barRadius / 2, 2))
        .attr('ry', Math.max(barRadius / 2, 2))
        .attr('fill', colorScale(group));

      legendItem
        .append('text')
        .attr('x', 20)
        .attr('y', 2)
        .style('fill', theme.axisTextColor)
        .style('font-size', '12px')
        .style('font-weight', 500)
        .text(group);
    });
  }
}

/**
 * Helper function to set up chart container
 * @param container Container element
 *
 * NOTE: This is a helper method for internal use. You can implement your own container setup
 * directly in the render/resize methods if needed.
 */
function setupContainer(container: HTMLElement, theme: ThemeContext): HTMLElement {
  container.innerHTML = '';
  container.style.background = theme.backgroundColor;

  const chartContainer = document.createElement('div');
  chartContainer.className = 'bar-chart-container';
  chartContainer.style.background = theme.backgroundColor;
  chartContainer.style.setProperty('--chart-background', theme.backgroundColor);
  chartContainer.style.setProperty('--axis-text-color', theme.axisTextColor);
  chartContainer.style.setProperty('--axis-line-color', theme.axisLineColor);
  chartContainer.style.setProperty('--control-bg', theme.controlBackground);
  chartContainer.style.setProperty('--control-border', theme.controlBorder);
  chartContainer.style.setProperty('--control-text', theme.controlText);
  chartContainer.style.setProperty('--control-hover-bg', theme.controlHoverBackground);
  chartContainer.style.setProperty('--hover-shadow', theme.hoverShadow);
  chartContainer.style.setProperty('--selected-shadow', theme.selectedShadow);
  chartContainer.style.setProperty('--tooltip-bg', theme.tooltipBackground);
  chartContainer.style.setProperty('--tooltip-color', theme.tooltipColor);
  chartContainer.style.setProperty('--bar-radius', `${theme.barRounding}px`);
  chartContainer.style.setProperty('--chart-font-family', theme.fontFamily);

  if (theme.fontFamily) {
    chartContainer.style.fontFamily = theme.fontFamily;
  }

  container.appendChild(chartContainer);

  const clearFilterBtn = document.createElement('button');
  clearFilterBtn.className = 'clear-filter-btn';
  clearFilterBtn.textContent = 'Clear Filters';
  clearFilterBtn.onclick = () => {
    chartState.selectedBars.clear();
    d3.selectAll<SVGRectElement, unknown>('.bar')
      .classed('bar-selected', false)
      .each(function () {
        const selection = d3.select(this as SVGRectElement);
        const baseFill = selection.attr('data-base-fill');
        if (baseFill) {
          selection.attr('fill', baseFill);
        }
        selection
          .attr('stroke', 'none')
          .attr('stroke-width', 0)
          .style('filter', 'none');
      });
    clearFilterBtn.classList.remove('visible');
    sendFilterEvent([]);
  };
  chartContainer.appendChild(clearFilterBtn);

  return chartContainer;
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
  data: ItemData['data'],
  measureSlot: Slot,
  categorySlot: Slot,
  groupSlot: Slot,
  measureFormatter: (value: number) => string
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
      : (val: any) => String(val)
  };

  const hasGroup = groupSlot?.content?.length! > 0;
  const indices = {
    category: 0,
    group: hasGroup ? 1 : -1,
    measure: hasGroup ? 2 : 1
  };

  return (data ?? []).map((row) => {
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
    const formattedValue = measureFormatter(rawValue);

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
