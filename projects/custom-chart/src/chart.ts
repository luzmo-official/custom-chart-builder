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
  tooltipFontSize: number;
  tooltipOpacity: number;
  gridOpacity: number;
  axisFontSize: number;
  isDark: boolean;
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

function getTextColorByBackground(background: string): string {
  const rgb = toRgb(background);
  return getRelativeLuminance(rgb) < 0.45 ? '#f8fafc' : '#111827';
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

function resolveTheme(theme?: ItemThemeConfig, overrides?: ChartThemeOverrides): ThemeContext {
  const backgroundColor = overrides?.backgroundColor && overrides.backgroundColor !== 'transparent'
    ? overrides.backgroundColor
    : (theme?.itemsBackground || '#ffffff');
  const backgroundRgb = toRgb(backgroundColor);
  const luminance = getRelativeLuminance(backgroundRgb);
  const isDark = luminance < 0.45;
  const axisTextColor = overrides?.axisColor || (isDark ? '#f8fafc' : '#1f2937');
  const axisLineReference =
    luminance < 0.45 ? lightenColor(backgroundColor, 0.25) : darkenColor(backgroundColor, 0.15);
  const axisLineColor = overrides?.axisColor || (d3.color(axisLineReference)?.formatHex() ?? '#d1d5db');

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
  const hoverShadow = `rgba(${hoverShadowBase.r}, ${hoverShadowBase.g}, ${hoverShadowBase.b}, ${isDark ? 0.55 : 0.25
    })`;
  const selectedShadow = `rgba(${selectedShadowBase.r}, ${selectedShadowBase.g}, ${selectedShadowBase.b}, ${isDark ? 0.55 : 0.35
    })`;

  const tooltipBaseColor = theme?.tooltip?.background ||
    (isDark ? lightenColor(backgroundColor, 0.18) : darkenColor(backgroundColor, 0.35));
  const tooltipOpacity = theme?.tooltip?.opacity ?? 0.92;
  const tooltipColorRgb = toRgb(tooltipBaseColor);
  const tooltipBackground = `rgba(${tooltipColorRgb.r}, ${tooltipColorRgb.g}, ${tooltipColorRgb.b}, ${tooltipOpacity})`;
  const tooltipColor = getTextColorByBackground(tooltipBaseColor);
  const tooltipFontSize = theme?.tooltip?.fontSize ?? 13;
  const gridOpacity = overrides?.gridOpacity ?? 0.1;
  const axisFontSize = overrides?.fontSize ?? theme?.axis?.fontSize ?? 12;

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
    tooltipFontSize,
    tooltipOpacity,
    gridOpacity,
    axisFontSize,
    isDark
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

interface ChartThemeOverrides {
  backgroundColor?: string;
  axisColor?: string;
  gridOpacity?: number;
  fontSize?: number;
}

interface ChartOptions {
  mode: 'grouped' | 'stacked';
  orientation: 'vertical' | 'horizontal';
  showLegend: boolean;
  showValues: boolean;
  barRounding: number | null;
  themeOverrides: ChartThemeOverrides;
}

function extractChartOptions(options: Record<string, unknown>): ChartOptions {
  const display = (options.display as Record<string, unknown>) ?? {};

  return {
    mode: (options.mode as ChartOptions['mode']) ?? 'grouped',
    orientation: (options.orientation as ChartOptions['orientation']) ?? 'vertical',
    showLegend: (display.legend as boolean) ?? true,
    showValues: (display.values as boolean) ?? false,
    barRounding: typeof options.barRounding === 'number' ? options.barRounding : null,
    themeOverrides: {
      backgroundColor: options.chartBackground as string | undefined,
      axisColor: options.chartAxisColor as string | undefined,
      gridOpacity: options.chartGridOpacity as number | undefined,
      fontSize: options.chartFontSize as number | undefined,
    }
  };
}

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
  console.log('[CustomChart] render()', { options, language, width, height });
  const chartOpts = extractChartOptions(options);
  const themeContext = resolveTheme(options.theme, chartOpts.themeOverrides);
  console.log('[CustomChart] resolved options:', chartOpts);
  (container as any).__themeContext = themeContext;
  (container as any).__chartOptions = chartOpts;
  const chartContainer = setupContainer(container, themeContext);

  chartState.categorySlot = slots.find((s) => s.name === 'category');
  chartState.measureSlot = slots.find((s) => s.name === 'measure');
  chartState.groupSlot = slots.find((s) => s.name === 'legend');

  const measureFormatterFn =
    chartState.measureSlot?.content?.[0]
      ? formatter(chartState.measureSlot.content[0])
      : (value: number) => new Intl.NumberFormat(language).format(value);

  const hasCategory = chartState.categorySlot?.content?.length! > 0;
  const hasMeasure = chartState.measureSlot?.content?.length! > 0;

  let chartData: ChartDataItem[] = [];

  if (!data.length || !hasCategory || !hasMeasure) {
    const categories = ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'];
    const groups = ['Region 1', 'Region 2', 'Region 3'];
    const sampleData = [];

    for (let i = 0; i < categories.length; i++) {
      for (let j = 0; j < groups.length; j++) {
        const rawValue = Math.floor(Math.random() * 800) + 200;
        sampleData.push({
          category: categories[i],
          group: groups[j],
          value: measureFormatterFn(rawValue),
          rawValue: rawValue,
          columnId: `column_${i}_${j}`,
          datasetId: `dataset_${i}_${j}`
        });
      }
    }

    chartData = sampleData;
  }
  else {
    chartData = preProcessData(
      data,
      chartState.measureSlot!,
      chartState.categorySlot!,
      chartState.groupSlot!,
      measureFormatterFn
    );
  }

  const groups: string[] = Array.from(new Set(chartData.map((d) => d.group)));
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');
  const showLegend = chartOpts.showLegend && hasMultipleGroups;
  const legendHeight = showLegend ? calculateLegendHeight(groups, width) : 0;

  const isHorizontal = chartOpts.orientation === 'horizontal';
  const margin = isHorizontal
    ? { top: 20 + legendHeight, right: 30, bottom: 30, left: 100 }
    : { top: 40 + legendHeight, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  renderChart(
    chartContainer,
    chartData,
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    themeContext,
    measureFormatterFn,
    chartOpts
  );

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
  console.log('[CustomChart] resize()', { options, width, height });
  const chartData = (container as any).__chartData || [];
  const chartOpts = extractChartOptions(options);
  const previousThemeContext = (container as any).__themeContext as ThemeContext | undefined;
  const themeContext = options.theme ? resolveTheme(options.theme, chartOpts.themeOverrides) : previousThemeContext ?? resolveTheme(undefined, chartOpts.themeOverrides);
  console.log('[CustomChart] resolved options:', chartOpts);
  (container as any).__themeContext = themeContext;
  (container as any).__chartOptions = chartOpts;
  const measureFormatterFn = chartState.measureSlot?.content?.[0]
    ? formatter(chartState.measureSlot.content[0])
    : (value: number) => new Intl.NumberFormat(language).format(value);
  const newChartContainer = setupContainer(container, themeContext);

  const groups: string[] = Array.from(new Set(chartData.map((d: ChartDataItem) => d.group)));
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');
  const showLegend = chartOpts.showLegend && hasMultipleGroups;
  const legendHeight = showLegend ? calculateLegendHeight(groups, width) : 0;

  const isHorizontal = chartOpts.orientation === 'horizontal';
  const margin = isHorizontal
    ? { top: 20 + legendHeight, right: 30, bottom: 30, left: 100 }
    : { top: 40 + legendHeight, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  renderChart(
    newChartContainer,
    chartData,
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    themeContext,
    measureFormatterFn,
    chartOpts
  );

  (container as any).__chartData = chartData;
};

export const optionsChanged = ({
  container,
  options,
  previousOptions
}: {
  container: HTMLElement;
  options: Record<string, unknown>;
  previousOptions: Record<string, unknown>;
}): void => {
  console.log('[CustomChart] optionsChanged()', { options, previousOptions });
  const chartData = (container as any).__chartData || [];
  if (!chartData.length) {
    console.warn('[CustomChart] optionsChanged() called with no chart data, skipping');
    return;
  }

  const chartOpts = extractChartOptions(options);
  const platformTheme = (options.theme as ItemThemeConfig) ?? undefined;
  const themeContext = resolveTheme(platformTheme, chartOpts.themeOverrides);
  console.log('[CustomChart] resolved options:', chartOpts);
  (container as any).__themeContext = themeContext;
  (container as any).__chartOptions = chartOpts;

  const measureFormatterFn = chartState.measureSlot?.content?.[0]
    ? formatter(chartState.measureSlot.content[0])
    : (value: number) => new Intl.NumberFormat('en').format(value);

  const groups: string[] = Array.from(new Set(chartData.map((d: ChartDataItem) => d.group)));
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');
  const showLegend = chartOpts.showLegend && hasMultipleGroups;

  const { width, height } = container.getBoundingClientRect();

  const newChartContainer = setupContainer(container, themeContext);
  const legendHeight = showLegend ? calculateLegendHeight(groups, width) : 0;

  const isHorizontal = chartOpts.orientation === 'horizontal';
  const margin = isHorizontal
    ? { top: 20 + legendHeight, right: 30, bottom: 30, left: 100 }
    : { top: 40 + legendHeight, right: 30, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  renderChart(
    newChartContainer,
    chartData,
    width,
    height,
    margin,
    innerWidth,
    innerHeight,
    themeContext,
    measureFormatterFn,
    chartOpts
  );
};

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
  measureFormatter: (value: number) => string,
  chartOpts: ChartOptions = { mode: 'grouped', orientation: 'vertical', showLegend: true, showValues: false, barRounding: null }
): void {
  const isHorizontal = chartOpts.orientation === 'horizontal';
  const isStacked = chartOpts.mode === 'stacked';
  const effectiveBarRounding = chartOpts.barRounding ?? theme.barRounding;

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

  const categories: string[] = Array.from(new Set(chartData.map((d) => d.category)));
  const groups: string[] = Array.from(new Set(chartData.map((d) => d.group)));
  const hasMultipleGroups = groups.length > 1 || (groups.length === 1 && groups[0] !== 'Default');

  const palette = expandPalette(theme.basePalette, theme.mainColor, Math.max(groups.length, 1));
  const colorScale: d3.ScaleOrdinal<string, string> = d3
    .scaleOrdinal<string>()
    .domain(groups)
    .range(palette);

  let maxValue: number;
  if (isStacked) {
    const stackedTotals = new Map<string, number>();
    chartData.forEach((d) => {
      stackedTotals.set(d.category, (stackedTotals.get(d.category) ?? 0) + d.rawValue);
    });
    maxValue = d3.max(Array.from(stackedTotals.values())) || 0;
  } else {
    maxValue = d3.max(chartData, (d) => d.rawValue) || 0;
  }

  const categoryScale: d3.ScaleBand<string> = d3
    .scaleBand<string>()
    .domain(categories)
    .range(isHorizontal ? [0, innerHeight] : [0, innerWidth])
    .padding(theme.barPadding);

  const groupScale: d3.ScaleBand<string> = d3
    .scaleBand<string>()
    .domain(groups)
    .range([0, Math.max(categoryScale.bandwidth(), 0)])
    .padding(hasMultipleGroups && !isStacked ? Math.min(0.35, theme.barPadding * 0.6) : 0.08);

  const valueScale: d3.ScaleLinear<number, number> = d3
    .scaleLinear()
    .domain([0, maxValue === 0 ? 1 : maxValue * 1.1])
    .range(isHorizontal ? [0, innerWidth] : [innerHeight, 0])
    .nice();

  const baseBarWidth = (isStacked || !hasMultipleGroups) ? categoryScale.bandwidth() : groupScale.bandwidth();
  const barRadius = Math.min(effectiveBarRounding, Math.max(baseBarWidth, 0) / 2);

  if (isHorizontal) {
    const yAxis = chart
      .append('g')
      .attr('class', 'axis y-axis')
      .call(d3.axisLeft(categoryScale).tickSizeOuter(0));
    yAxis.selectAll<SVGTextElement, string>('text').style('fill', theme.axisTextColor).style('font-size', `${theme.axisFontSize}px`);
    if (theme.fontFamily) { yAxis.selectAll<SVGTextElement, string>('text').style('font-family', theme.fontFamily); }
    yAxis.selectAll<SVGLineElement, unknown>('line').attr('stroke', theme.axisLineColor);
    yAxis.selectAll<SVGPathElement, unknown>('path').attr('stroke', theme.axisLineColor);

    const xAxisGenerator = d3.axisBottom(valueScale)
      .ticks(6)
      .tickSize(-innerHeight)
      .tickSizeOuter(0)
      .tickFormat((value) => measureFormatter(Number(value)));
    const xAxis = chart.append('g').attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxisGenerator);
    xAxis.selectAll<SVGTextElement, number>('text').style('fill', theme.axisTextColor).style('font-size', `${theme.axisFontSize}px`);
    if (theme.fontFamily) { xAxis.selectAll<SVGTextElement, number>('text').style('font-family', theme.fontFamily); }
    xAxis.selectAll<SVGLineElement, number>('line').attr('stroke', theme.axisLineColor).attr('stroke-dasharray', '2,4').attr('opacity', theme.gridOpacity);
    xAxis.selectAll<SVGPathElement, unknown>('path').attr('stroke', theme.axisLineColor);
  } else {
    const xAxis = chart
      .append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(categoryScale).tickSizeOuter(0));
    xAxis.selectAll<SVGTextElement, string>('text')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .style('fill', theme.axisTextColor)
      .style('font-size', `${theme.axisFontSize}px`);
    if (theme.fontFamily) { xAxis.selectAll<SVGTextElement, string>('text').style('font-family', theme.fontFamily); }
    xAxis.selectAll<SVGLineElement, unknown>('line').attr('stroke', theme.axisLineColor);
    xAxis.selectAll<SVGPathElement, unknown>('path').attr('stroke', theme.axisLineColor);

    const yAxisGenerator = d3.axisLeft(valueScale)
      .ticks(6)
      .tickSize(-innerWidth)
      .tickSizeOuter(0)
      .tickFormat((value) => measureFormatter(Number(value)));
    const yAxis = chart.append('g').attr('class', 'axis y-axis').call(yAxisGenerator);
    yAxis.selectAll<SVGTextElement, number>('text').style('fill', theme.axisTextColor).style('font-size', `${theme.axisFontSize}px`);
    if (theme.fontFamily) { yAxis.selectAll<SVGTextElement, number>('text').style('font-family', theme.fontFamily); }
    yAxis.selectAll<SVGLineElement, number>('line').attr('stroke', theme.axisLineColor).attr('stroke-dasharray', '2,4').attr('opacity', theme.gridOpacity);
    yAxis.selectAll<SVGPathElement, unknown>('path').attr('stroke', theme.axisLineColor);
  }

  const baseFontSize = 13;
  const tooltip: d3.Selection<HTMLDivElement, unknown, null, undefined> = d3
    .select(chartContainer)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('background', theme.tooltipBackground)
    .style('color', theme.tooltipColor)
    .style('font-size', theme.tooltipFontSize + 'px')
    .style('line-height', theme.tooltipFontSize * 1.4 + 'px')
    .style('max-width', 250 * (theme.tooltipFontSize / baseFontSize) + 'px')
    .style('overflow-wrap', 'break-word');

  const resolveSlotLabel = (slot: Slot | undefined, fallback: string): string => {
    const name = slot?.name || fallback;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  const categoryLabel = resolveSlotLabel(chartState.categorySlot, 'Category');
  const measureLabel = resolveSlotLabel(chartState.measureSlot, 'Measure');
  const legendLabel = resolveSlotLabel(chartState.groupSlot, 'Legend');
  const measureCount = chartState.measureSlot?.content?.length ?? 0;
  const hasMeasure = measureCount > 0;
  const hasLegend = (chartState.groupSlot?.content?.length ?? 0) > 0;
  const multiMeasure = measureCount > 1;

  const buildTooltipHtml = (categoryValue: string, measureValue: string | number, legendValue: string): string => {
    const rows = [`<b>${categoryLabel}:</b> ${categoryValue}`];
    if (hasMeasure || measureCount === 1) {
      rows.push(`<b>${measureLabel}:</b> ${measureValue}`);
    }
    if (hasLegend && !multiMeasure) {
      rows.push(`<b>${legendLabel}:</b> ${legendValue}`);
    }
    return rows.join('<br>');
  };

  const tooltipPadding = 8;
  const tooltipOffset = 12;

  const positionTooltip = (event: MouseEvent): void => {
    const [pointerX, pointerY] = d3.pointer(event, chartContainer);
    const tooltipNode = tooltip.node();
    if (!tooltipNode) { return; }

    const tooltipWidth = tooltipNode.offsetWidth || 200;
    const tooltipHeight = tooltipNode.offsetHeight || 80;
    const maxLeft = Math.max(tooltipPadding, chartContainer.clientWidth - tooltipWidth - tooltipPadding);
    const maxTop = Math.max(tooltipPadding, chartContainer.clientHeight - tooltipHeight - tooltipPadding);

    let x = pointerX + tooltipOffset;
    let y = pointerY + tooltipOffset;
    if (x > maxLeft) { x = pointerX - tooltipWidth - tooltipOffset; }
    if (y > maxTop) { y = pointerY - tooltipHeight - tooltipOffset; }
    x = Math.max(tooltipPadding, Math.min(x, maxLeft));
    y = Math.max(tooltipPadding, Math.min(y, maxTop));

    tooltip.style('left', `${x}px`).style('top', `${y}px`);
  };

  const stackOffsets = new Map<string, number>();

  categories.forEach((category) => {
    const categoryData = chartData.filter((d) => d.category === category);
    stackOffsets.set(category, 0);

    groups.forEach((group) => {
      const datum = categoryData.find((d) => d.group === group);
      if (!datum) { return; }

      const barId = `${category}-${group}`;
      const baseFill = colorScale(group);

      let barX: number, barY: number, barW: number, barH: number;

      if (isStacked) {
        const offset = stackOffsets.get(category) ?? 0;
        if (isHorizontal) {
          barX = valueScale(0) + offset;
          barY = categoryScale(category) ?? 0;
          barW = valueScale(datum.rawValue) - valueScale(0);
          barH = categoryScale.bandwidth();
        } else {
          barW = categoryScale.bandwidth();
          barH = valueScale(0) - valueScale(datum.rawValue);
          barX = categoryScale(category) ?? 0;
          barY = valueScale(datum.rawValue) - offset;
          barY = valueScale(0) - offset - barH;
        }
        stackOffsets.set(category, offset + (isHorizontal ? barW : barH));
      } else {
        if (isHorizontal) {
          barX = 0;
          barY = (categoryScale(category) ?? 0) + (hasMultipleGroups ? groupScale(group) ?? 0 : 0);
          barW = valueScale(datum.rawValue);
          barH = hasMultipleGroups ? groupScale.bandwidth() : categoryScale.bandwidth();
        } else {
          barX = (categoryScale(category) ?? 0) + (hasMultipleGroups ? groupScale(group) ?? 0 : 0);
          barY = valueScale(datum.rawValue);
          barW = hasMultipleGroups ? groupScale.bandwidth() : categoryScale.bandwidth();
          barH = innerHeight - valueScale(datum.rawValue);
        }
      }

      const bar = chart
        .append('rect')
        .attr('class', 'bar')
        .attr('data-bar-id', barId)
        .attr('data-base-fill', baseFill)
        .attr('x', barX)
        .attr('y', barY)
        .attr('width', Math.max(0, barW))
        .attr('height', Math.max(0, barH))
        .attr('fill', baseFill)
        .attr('rx', barRadius)
        .attr('ry', barRadius);

      if (chartOpts.showValues && datum.rawValue > 0) {
        const labelX = isHorizontal ? barX + barW + 4 : barX + barW / 2;
        const labelY = isHorizontal ? barY + barH / 2 : barY - 4;
        chart
          .append('text')
          .attr('class', 'bar-value')
          .attr('x', labelX)
          .attr('y', labelY)
          .attr('text-anchor', isHorizontal ? 'start' : 'middle')
          .attr('dominant-baseline', isHorizontal ? 'central' : 'auto')
          .style('fill', theme.axisTextColor)
          .style('font-size', '11px')
          .style('pointer-events', 'none')
          .text(measureFormatter(datum.rawValue));
      }

      bar
        .on('mouseover', function (event: MouseEvent) {
          const selection = d3.select(this as SVGRectElement);
          const startingFill = selection.attr('data-base-fill') || baseFill;
          selection
            .raise()
            .attr('fill', lightenColor(startingFill, 0.18))
            .style('filter', `drop-shadow(0 12px 20px ${theme.hoverShadow})`);
          tooltip
            .interrupt()
            .style('opacity', 1)
            .html(buildTooltipHtml(category, datum.value, group))
            .style('left', '0px')
            .style('top', '0px');
          positionTooltip(event);
        })
        .on('mousemove', function (event: MouseEvent) { positionTooltip(event); })
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
            selection.attr('fill', startingFill).style('filter', 'none');
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
            if (!categoryContent) { return; }
            const columnKey = `${categoryContent.columnId || (categoryContent as any).column}:${categoryContent.datasetId || (categoryContent as any).set}`;
            if (!groupedFilters.has(columnKey)) { groupedFilters.set(columnKey, new Set()); }
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
              properties: { origin: 'filterFromVizItem', type: 'where' }
            });
          });

          sendFilterEvent(filters);
          sendCustomEvent({ category, group, value: datum.value, rawValue: datum.rawValue });
        });
    });
  });

  const showLegend = chartOpts.showLegend && hasMultipleGroups;

  if (showLegend) {
    const itemWidth = 140;
    const rowHeight = 24;
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
  chartContainer.style.setProperty('--hover-shadow', theme.hoverShadow);
  chartContainer.style.setProperty('--bar-radius', `${theme.barRounding}px`);
  chartContainer.style.setProperty('--chart-font-family', theme.fontFamily);
  chartContainer.style.setProperty('--clear-filter-bg', theme.isDark ? 'rgba(255, 255, 255, 0.6)' : 'rgba(0, 0, 0, 0.6)');
  chartContainer.style.setProperty('--clear-filter-color', theme.isDark ? '#333' : '#eee');
  chartContainer.style.setProperty('--clear-filter-hover-bg', theme.isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.9)');
  chartContainer.style.setProperty('--clear-filter-hover-color', theme.isDark ? '#333' : '#fff');

  if (theme.fontFamily) {
    chartContainer.style.fontFamily = theme.fontFamily;
  }

  container.appendChild(chartContainer);

  const clearFilterBtn = document.createElement('div');
  clearFilterBtn.className = 'clear-filter-btn';
  clearFilterBtn.textContent = 'Clear filter';
  clearFilterBtn.style.fontSize = `${11 + 11 * ((theme.tooltipFontSize / 13) - 1) / 2}px`;
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
    const categoryValue = row[indices.category]?.name?.en || row[indices.category] || 'Unknown';
    const category = formatters.category(
      categorySlot.content[0].type === 'datetime'
        ? new Date(categoryValue)
        : categoryValue
    );

    const groupValue = row[indices.group]?.name?.en || row[indices.group] || 'Default';
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
