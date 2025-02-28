import { Slot, SlotConfig, ItemQueryDimension, ItemQueryMeasure, ItemQuery } from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';
import * as d3Hexbin from 'd3-hexbin';
import {
  addToDimensions,
  addToMeasures,
  getSlotCategoryBySlotDefinition,
  getSlotMeasureBySlotDefinition
} from './build-query.utils';

type SideValues = {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

type Dimensions = {
  padding?: SideValues,
  margin?: SideValues,
  width?: number,  // Final width of the chart
  height?: number, // Final height of the chart
  outerWidth?: number, // Outer width of the SVG (After substracting margin from the width)
  outerHeight?: number,  // Outer height of the SVG
  innerWidth?: number, // Inner width of the SVG (after substracting padding from the outerWidth)
  innerHeight?: number // Inner height of the SVG
}

// Extend the hexbin bin interface to store our animation state.
interface HexBinExtended extends d3Hexbin.HexbinBin<[number, number]> {
  selected?: boolean;
  path?: Path2D;
  currentOpacity?: number;
  targetOpacity?: number;
  startOpacity?: number;
}

interface CanvasState {
  margin: { top: number; right: number; bottom: number; left: number };
  width: number;
  height: number;
  data: [number, number][];
  xScale: d3.ScaleLinear<number, number>;
  yScale: d3.ScaleLinear<number, number>;
  hexbin: d3Hexbin.Hexbin<[number, number]>;
  bins: HexBinExtended[];
  maxCount: number;
  totalClicks: number;
  colorScale: d3.ScaleSequential<string>;
  hexagonPath: Path2D;
  isEmptyData?: boolean;
}

// Define the LUZMO letters
const LUZMO_LETTERS = {
  L: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4]],
  U: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]],
  Z: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 2], [1, 3], [0, 4], [1, 4], [2, 4], [3, 4]],
  M: [[0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 1], [2, 2], [3, 1], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
  O: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 3], [0, 2], [0, 1]]
};

// Debounce function
function debounce(func: Function, wait: number): (...args: any[]) => void {
  let timeout: number | null = null;

  return function(...args: any[]) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout !== null) {
      window.clearTimeout(timeout);
    }
    timeout = window.setTimeout(later, wait);
  };
}

/**
 * Render the LUZMO logo using animated dots
 */
function renderLuzmoLogo(
  container: HTMLElement,
  width: number,
  height: number
): { canvas: HTMLCanvasElement, dots: any[], animate: () => void } {
  // Base design values
  const baseDotSize = 10;
  const baseGridSize = 20;
  const baseLetterSpacing = 50;
  const animationDuration = 200;

  // Calculate the total width and height of the design using the base values.
  const baseLetterWidths = Object.values(LUZMO_LETTERS).map(
    l => Math.max(...l.map(([x]) => x)) * baseGridSize + baseGridSize
  );
  const baseTotalLetterWidth =
    baseLetterWidths.reduce((a, b) => a + b, 0) +
    baseLetterSpacing * (Object.keys(LUZMO_LETTERS).length - 1);
  const baseTotalLetterHeight = 5 * baseGridSize;

  // Compute a scale factor such that the letters will fit in the canvas.
  // We use Math.min to only scale down (never scale up beyond our base design).
  const scale = Math.min(1, width / baseTotalLetterWidth, height / baseTotalLetterHeight);

  // Scale the design parameters
  const gridSize = baseGridSize * scale;
  const dotSize = baseDotSize * scale;
  const letterSpacing = baseLetterSpacing * scale;

  // Recalculate each letter's width using the scaled gridSize.
  const letterWidths = Object.values(LUZMO_LETTERS).map(
    l => Math.max(...l.map(([x]) => x)) * gridSize + gridSize
  );
  const totalLetterWidth =
    letterWidths.reduce((a, b) => a + b, 0) + letterSpacing * (letterWidths.length - 1);

  // Center the letters within the canvas
  let offsetX = (width - totalLetterWidth) / 2;
  const offsetY = (height - 5 * gridSize) / 2;

  // IMPORTANT: Clear any existing elements first
  // Remove any existing tooltip and clear selection button
  d3.select(container).selectAll('.tooltip, .clear-selection-btn').remove();

  // Either select an existing canvas or create one
  let canvasSelection = d3.select(container).select<HTMLCanvasElement>('canvas');
  if (canvasSelection.empty()) {
    canvasSelection = d3.select(container)
      .append('canvas')
      .attr('width', width)
      .attr('height', height)
      .style('display', 'block');
  } else {
    // Update existing canvas size
    canvasSelection
      .attr('width', width)
      .attr('height', height);
  }

  const canvas = canvasSelection.node() as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // Clear any existing state
  (canvas as any)._state = null;

  // Draw the background.
  ctx.fillStyle = '#262626';
  ctx.fillRect(0, 0, width, height);

  // Create an array to hold the dot data.
  let dots: { x: number; y: number; opacity: number; targetOpacity: number }[] = [];

  // Iterate over the letters and draw each dot.
  Object.entries(LUZMO_LETTERS).forEach(([, positions], index) => {
    positions.forEach(([x, y]) => {
      const posX = offsetX + x * gridSize;
      const posY = offsetY + y * gridSize;
      dots.push({ x: posX, y: posY, opacity: 1, targetOpacity: 1 });

      ctx.beginPath();
      ctx.arc(posX, posY, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = '#ebff00';
      ctx.fill();
    });

    offsetX += letterWidths[index] + letterSpacing;
  });

  let lastUpdate = Date.now();
  let animationId: number | null = null;

  // Animation function
  function animate() {
    if (!ctx) return;
    const now = Date.now();
    const deltaTime = now - lastUpdate;
    lastUpdate = now;

    // Clear and redraw the background.
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#262626';
    ctx.fillRect(0, 0, width, height);

    // Animate the dots.
    dots.forEach(dot => {
      dot.opacity += (dot.targetOpacity - dot.opacity) * (deltaTime / animationDuration);
      dot.opacity = Math.max(0.3, Math.min(1, dot.opacity));

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235, 255, 0, ${dot.opacity})`;
      ctx.fill();
    });

    animationId = requestAnimationFrame(animate);
  }

  // Start animation
  animate();

  // Add interactivity
  canvasSelection.on('mousemove', function (event) {
    const [mouseX, mouseY] = d3.pointer(event, canvas);
    let hoveredDot: { x: number; y: number } | undefined;

    dots.forEach(dot => {
      const dx = mouseX - dot.x;
      const dy = mouseY - dot.y;
      if (Math.sqrt(dx * dx + dy * dy) < dotSize) {
        hoveredDot = dot;
      }
    });

    dots.forEach(dot => (dot.targetOpacity = hoveredDot ? (dot === hoveredDot ? 1 : 0.3) : 1));
  });

  // Store logo state on canvas
  (canvas as any)._logoState = {
    width,
    height,
    dots,
    animationId,
    dotSize
  };

  return { canvas, dots, animate };
}

/**
 * Render the hexbin map using canvas or LUZMO logo if data is empty.
 */
export const render = ({
  container,
  data = [],
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 },
}: {
  container: HTMLElement;
  data: [number, number][];
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any>;
  language: string;
  dimensions: { width: number; height: number };
}): void => {
  console.log('Rendering with data length:', data.length);

  // Check if data is empty or invalid
  const isEmptyData = !data || data.length === 0 || !Array.isArray(data);

  if (isEmptyData) {
    console.log('No data available, rendering LUZMO logo');
    // Clean up any existing canvas state
    const existingCanvas = d3.select(container).select<HTMLCanvasElement>('canvas').node();
    if (existingCanvas) {
      // Clean up any existing hex chart elements
      d3.select(container).selectAll('.tooltip, .clear-selection-btn').remove();

      // Stop any ongoing hex animations
      const hexState = (existingCanvas as any)._state;
      if (hexState && hexState.animationId) {
        cancelAnimationFrame(hexState.animationId);
      }

      // Stop any ongoing logo animations
      const logoState = (existingCanvas as any)._logoState;
      if (logoState && logoState.animationId) {
        cancelAnimationFrame(logoState.animationId);
      }
    }

    renderLuzmoLogo(container, width, height);
    return;
  }

  // Data is available, render hex chart
  console.log('Rendering hex chart with data');
  const margin = { top: 20, right: 20, bottom: 30, left: 40 };

  // Clear any existing animation and state
  const existingCanvas = d3.select(container).select<HTMLCanvasElement>('canvas').node();
  if (existingCanvas) {
    // Stop logo animation if it exists
    const logoState = (existingCanvas as any)._logoState;
    if (logoState && logoState.animationId) {
      cancelAnimationFrame(logoState.animationId);
      (existingCanvas as any)._logoState = null;
    }
  }

  // Clear all existing elements for a fresh start
  d3.select(container).selectAll('canvas').remove();
  d3.select(container).selectAll('.tooltip, .clear-selection-btn').remove();

  // Create a new canvas
  const canvasSelection = d3.select(container)
    .append('canvas')
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  const canvas = canvasSelection.node() as HTMLCanvasElement;
  const ctx = canvas.getContext('2d')!;

  // Store the new data
  (canvas as any).__data__ = data;

  // Set up scales based on the data extents.
  const xExtent = d3.extent(data, (d) => +d[0]);
  const yExtent = d3.extent(data, (d) => +d[1]);
  if (
    xExtent[0] === undefined ||
    xExtent[1] === undefined ||
    yExtent[0] === undefined ||
    yExtent[1] === undefined
  ) {
    console.warn('Invalid data extents, falling back to LUZMO logo');
    renderLuzmoLogo(container, width, height);
    return;
  }

  const xScale = d3.scaleLinear().domain(xExtent).nice().range([margin.left, width - margin.right]);
  const yScale = d3.scaleLinear().domain(yExtent).nice().range([height - margin.bottom, margin.top]);

  // Create the hexbin generator.
  const hexbin = d3Hexbin.hexbin()
    .x((d) => xScale(d[0]))
    .y((d) => yScale(d[1]))
    .radius(6)
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

  // Compute the bins.
  const bins = hexbin(data) as HexBinExtended[];
  const maxCount = d3.max(bins, (d) => d.length) || 1;
  const totalClicks = data.length;

  // Create a color scale mapping bin count to color.
  const colorScale = d3.scaleSequential(d3.interpolateMagma).domain([0, maxCount]);
  // Precompute the basic hexagon path from the hexbin generator.
  const hexPathString = hexbin.hexagon();
  const hexagonPath = new Path2D(hexPathString);

  // For each bin, create a transformed Path2D and initialize animation state.
  bins.forEach((bin) => {
    bin.selected = false;
    const path = new Path2D();
    const matrix = new DOMMatrix().translate(bin.x, bin.y);
    path.addPath(hexagonPath, matrix);
    bin.path = path;
    bin.currentOpacity = 0.3 + 0.7 * (bin.length / maxCount);
  });

  // Save the state on the canvas element.
  const state: CanvasState = {
    margin,
    width,
    height,
    data,
    xScale,
    yScale,
    hexbin,
    bins,
    maxCount,
    totalClicks,
    colorScale,
    hexagonPath,
    isEmptyData: false
  };
  (canvas as any)._state = state;

  // --- DRAWING FUNCTION ---
  function drawCanvas() {
    // Always clear the entire canvas.
    ctx.clearRect(0, 0, width, height);
    // Draw the background image if available and loaded.
    const bgImg = (canvas as any)._bgImg as HTMLImageElement | undefined;
    if (bgImg && bgImg.complete) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.drawImage(bgImg, 0, 0, width, height);
      ctx.restore();
    }
    // Draw each hexagon.
    bins.forEach((bin) => {
      ctx.save();
      ctx.fillStyle = colorScale(bin.length) as string;
      ctx.globalAlpha =
        bin.currentOpacity !== undefined ? bin.currentOpacity : (0.3 + 0.7 * (bin.length / maxCount));
      ctx.strokeStyle = 'black';
      // Use a thicker line for a selected or hovered bin.
      ctx.lineWidth = (bin.selected || (currentHovered === bin)) ? 1.25 : 0.15;
      if (bin.path) {
        ctx.fill(bin.path);
        ctx.stroke(bin.path);
      }
      ctx.restore();
    });
  }

  // --- ANIMATION FUNCTION ---
  function animateOpacityTransition(duration: number) {
    const startTime = Date.now();
    bins.forEach((bin) => {
      bin.startOpacity = bin.currentOpacity!;
    });
    d3.timer(function () {
      const elapsed = Date.now() - startTime;
      let t = elapsed / duration;
      if (t > 1) t = 1;
      t = d3.easeCubicOut(t);
      bins.forEach((bin) => {
        if (bin.startOpacity !== undefined && bin.targetOpacity !== undefined) {
          bin.currentOpacity = bin.startOpacity + (bin.targetOpacity - bin.startOpacity) * t;
        }
      });
      drawCanvas();
      if (t === 1) return true;
      return false;
    });
  }

  // --- BACKGROUND IMAGE SETUP ---
  // (Move this after drawCanvas is defined so that closures capture bins correctly.)
  let bgImg = (canvas as any)._bgImg as HTMLImageElement | undefined;
  if (!bgImg) {
    bgImg = new Image();
    bgImg.src = 'https://savvycomsoftware.com/wp-content/uploads/2023/06/Saas-App-Development-1.webp';
    (canvas as any)._bgImg = bgImg;
    bgImg.onload = () => {
      // When the image loads, redraw the canvas.
      drawCanvas();
    };
  }

  // Variable to track the currently hovered bin.
  let currentHovered: HexBinExtended | null = null;

  // --- TOOLTIP SETUP ---
  let tooltip = d3.select(container)
    .append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('pointer-events', 'none')
    .style('background-color', '#000')
    .style('color', '#fff')
    .style('padding', '8px 12px')
    .style('border-radius', '6px')
    .style('font-family', 'Inter, sans-serif')
    .style('font-size', '14px')
    .style('line-height', '20px')
    .style('opacity', 0);

  // --- CLEAR SELECTION BUTTON ---
  let clearSelectionBtn = d3.select(container)
    .append('div')
    .attr('class', 'clear-selection-btn')
    .style('position', 'absolute')
    .style('pointer-events', 'auto')
    .style('background-color', '#000')
    .style('color', '#fff')
    .style('padding', '6px 8px')
    .style('border-radius', '6px')
    .style('font-family', 'Inter, sans-serif')
    .style('font-size', '12px')
    .style('opacity', 0)
    .style('cursor', 'pointer')
    .text('Clear selection')
    .on('click', function (event) {
      event.stopPropagation();
      clearSelection();
    });

  // Helper function to update the clear-selection button's position.
  function updateClearSelectionButtonPosition() {
    const canvasRect = canvas.getBoundingClientRect();
    const canvasLeft = canvasRect.left + window.pageXOffset;
    const canvasTop = canvasRect.top + window.pageYOffset;
    clearSelectionBtn
      .style('left', `${canvasLeft + 10}px`)
      .style('top', `${canvasTop + 10}px`);
  }
  updateClearSelectionButtonPosition();

  // Use namespaced events with debouncing for resize/scroll
  const debouncedUpdatePosition = debounce(updateClearSelectionButtonPosition, 100);

  // Use namespaced events so that subsequent calls replace the old ones.
  d3.select(window)
    .on('scroll.renderClearBtn', debouncedUpdatePosition)
    .on('resize.renderClearBtn', debouncedUpdatePosition);

  // Helper function to clear any selection.
  function clearSelection() {
    bins.forEach((bin) => (bin.selected = false));
    bins.forEach((bin) => {
      bin.targetOpacity = 0.3 + 0.7 * (bin.length / maxCount);
    });
    animateOpacityTransition(300);
    clearSelectionBtn.style('opacity', 0);
  }

  // Helper to get mouse position relative to the canvas.
  function getMousePos(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  // --- INTERACTIVITY (Attach event listeners using namespaced d3 events) ---
  const canvasSel = d3.select(canvas);
  // Remove any previous listeners in our namespace.
  canvasSel.on('mousemove.render', null)
    .on('mouseout.render', null)
    .on('click.render', null);

  canvasSel
    .on('mousemove.render', function (event: MouseEvent) {
      const mousePos = getMousePos(event);
      const foundBin = bins.find((bin) =>
        bin.path ? ctx.isPointInPath(bin.path, mousePos.x, mousePos.y) : false
      );
      if (foundBin) {
        const X = xScale.invert(foundBin.x);
        const Y = yScale.invert(foundBin.y);
        const percent = ((foundBin.length / totalClicks) * 100).toFixed(2);
        tooltip
          .style('opacity', '0.925')
          .html(
            `<b>Coordinates</b>: (${X.toFixed(2)}, ${Y.toFixed(2)})<br/>
             <b>Click count</b>: ${foundBin.length} (${percent}% of total)`
          )
          .style('left', event.pageX + 7.5 + 'px')
          .style('top', event.pageY + 7.5 + 'px');
        canvas.style.cursor = 'pointer';
        if (currentHovered !== foundBin) {
          currentHovered = foundBin;
          drawCanvas();
        }
      } else {
        if (currentHovered !== null) {
          currentHovered = null;
          drawCanvas();
        }
        tooltip.style('opacity', '0');
        canvas.style.cursor = 'default';
      }
    })
    .on('mouseout.render', function () {
      tooltip.style('opacity', '0');
      if (currentHovered !== null) {
        currentHovered = null;
        drawCanvas();
      }
    })
    .on('click.render', function (event: MouseEvent) {
      const mousePos = getMousePos(event);
      const clickedBin = bins.find((bin) =>
        bin.path ? ctx.isPointInPath(bin.path, mousePos.x, mousePos.y) : false
      );
      if (clickedBin) {
        // Toggle selection: if already selected, clear all.
        if (clickedBin.selected) {
          bins.forEach((bin) => (bin.selected = false));
        } else {
          bins.forEach((bin) => (bin.selected = false));
          clickedBin.selected = true;
        }
        const selectionExists = bins.some((bin) => bin.selected);
        bins.forEach((bin) => {
          bin.targetOpacity = selectionExists
            ? (bin.selected ? 1 : 0.25)
            : (0.3 + 0.7 * (bin.length / maxCount));
        });
        animateOpacityTransition(300);
        clearSelectionBtn.style('opacity', selectionExists ? 0.925 : 0);
      }
    });

  // Final initial draw.
  drawCanvas();
};

// Create a debounced resize function at module level
let resizeTimer: number | null = null;
const RESIZE_DEBOUNCE_TIME = 200; // milliseconds

/**
 * Resize the chart while maintaining state.
 * Uses debounce to prevent excessive calls.
 */
export const resize = ({
  container,
  slots = [],
  slotConfigurations = [],
  options = {},
  language = 'en',
  dimensions: { width, height } = { width: 0, height: 0 },
}: {
  container: HTMLElement;
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any>;
  language: string;
  dimensions: { width: number; height: number };
}): void => {
  // Debounce the resize operation
  if (resizeTimer !== null) {
    window.clearTimeout(resizeTimer);
  }

  resizeTimer = window.setTimeout(() => {
    performResize(container, slots, slotConfigurations, options, language, width, height);
    resizeTimer = null;
  }, RESIZE_DEBOUNCE_TIME);
};

/**
 * Actual resize implementation after debouncing
 */
function performResize(
  container: HTMLElement,
  slots: Slot[] = [],
  slotConfigurations: SlotConfig[] = [],
  options: Record<string, any> = {},
  language: string = 'en',
  width: number = 0,
  height: number = 0
): void {
  // Select the existing canvas.
  const canvasSelection = d3.select(container).select<HTMLCanvasElement>('canvas');
  if (canvasSelection.empty()) return;
  const canvas = canvasSelection.node() as HTMLCanvasElement;

  // Check what type of content we have (logo or hex chart)
  const logoState = (canvas as any)._logoState;
  const hexState: CanvasState | undefined = (canvas as any)._state;

  if (logoState) {
    // We have a logo, resize it
    console.log('Resizing LUZMO logo');
    if (logoState.animationId) {
      cancelAnimationFrame(logoState.animationId);
    }
    // Simply re-render the logo with new dimensions
    renderLuzmoLogo(container, width, height);
    return;
  }

  if (!hexState || !hexState.data || hexState.data.length === 0) {
    // Either no state or empty data, render logo
    console.log('No valid hex state, rendering LUZMO logo');
    renderLuzmoLogo(container, width, height);
    return;
  }

  console.log('Resizing hex chart');
  const ctx = canvas.getContext('2d')!;

  // Update canvas dimensions.
  canvas.width = width ?? 0;
  canvas.height = height ?? 0;

  // Retrieve the previously stored state.
  const { margin, data } = hexState;

  // Recalculate scales based on the (unchanged) data domain and new ranges.
  const xExtent = d3.extent(data, (d) => +d[0]);
  const yExtent = d3.extent(data, (d) => +d[1]);
  if (
    xExtent[0] === undefined ||
    xExtent[1] === undefined ||
    yExtent[0] === undefined ||
    yExtent[1] === undefined
  ) {
    // Invalid data, switch to logo
    renderLuzmoLogo(container, width, height);
    return;
  }

  const xScale = d3.scaleLinear()
    .domain(xExtent)
    .nice()
    .range([margin.left, width - margin.right]);
  const yScale = d3.scaleLinear()
    .domain(yExtent)
    .nice()
    .range([height - margin.bottom, margin.top]);

  // Create a new hexbin generator with updated scales and extent.
  const hexbin = d3Hexbin.hexbin()
    .x((d) => xScale(d[0]))
    .y((d) => yScale(d[1]))
    .radius(6)
    .extent([[margin.left, margin.top], [width - margin.right, height - margin.bottom]]);

  // Recompute bins based on the new hexbin generator.
  const bins = hexbin(data) as HexBinExtended[];
  const maxCount = d3.max(bins, (d) => d.length) || 1;
  const colorScale = d3.scaleSequential(d3.interpolateMagma).domain([0, maxCount]);
  const hexPathString = hexbin.hexagon();
  const hexagonPath = new Path2D(hexPathString);

  // Update each bin – reset selection state, update opacity and recalc its path.
  bins.forEach((bin) => {
    bin.selected = false;
    bin.currentOpacity = 0.3 + 0.7 * (bin.length / maxCount);
    const path = new Path2D();
    const matrix = new DOMMatrix().translate(bin.x, bin.y);
    path.addPath(hexagonPath, matrix);
    bin.path = path;
  });

  // Update the saved state.
  hexState.width = width;
  hexState.height = height;
  hexState.xScale = xScale;
  hexState.yScale = yScale;
  hexState.hexbin = hexbin;
  hexState.bins = bins;
  hexState.maxCount = maxCount;
  hexState.colorScale = colorScale;
  hexState.hexagonPath = hexagonPath;

  // Clear and redraw the canvas.
  ctx.clearRect(0, 0, width, height);
  const bgImg = (canvas as any)._bgImg as HTMLImageElement | undefined;
  if (bgImg && bgImg.complete) {
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.drawImage(bgImg, 0, 0, width, height);
    ctx.restore();
  }
  bins.forEach((bin) => {
    ctx.save();
    ctx.fillStyle = colorScale(bin.length) as string;
    ctx.globalAlpha = bin.currentOpacity ?? (0.3 + 0.7 * (bin.length / maxCount));
    ctx.strokeStyle = 'black';
    ctx.lineWidth = bin.selected ? 1.25 : 0.15;
    if (bin.path) {
      ctx.fill(bin.path);
      ctx.stroke(bin.path);
    }
    ctx.restore();
  });

  // Update the clear-selection button's position.
  const clearSelectionBtn = d3.select(container).select('.clear-selection-btn');
  if (!clearSelectionBtn.empty()) {
    const { left, top } = canvas.getBoundingClientRect();
    clearSelectionBtn
      .style('left', `${left + window.pageXOffset + 10}px`)
      .style('top', `${top + window.pageYOffset + 10}px`);
  }
}

export const buildQuery = (data: { slots: Slot[], slotConfigurations: SlotConfig[] }): ItemQuery => {
  const measures: ItemQueryMeasure[] = [];
  const dimensions: ItemQueryDimension[] = [];

  const { slots, slotConfigurations } = data;

  const slotMeasuresByDefinition = getSlotMeasureBySlotDefinition(slotConfigurations);
  const allMeasureSlots = slots.filter(
    s => slotMeasuresByDefinition.find(sd => sd.name === s.name)
  );

  let hasMeasures = false;

  for (const measureSlot of allMeasureSlots) {
    for (const measureSlotContent of measureSlot.content) {
      hasMeasures = true;
      addToMeasures(measures, measureSlotContent);
    }
  }

  // From slotDefenitions we extract slots, whose type are categorical and sort them by order. These are our dimensions (categories and legends)
  const slotCategorySortedByOrder = getSlotCategoryBySlotDefinition(slotConfigurations)
    .sort((a, b) => a.order! - b.order!);

  if (slotCategorySortedByOrder?.length > 0) {
    // Get the actual slot
    const categorySlots = slots.filter(
      s => slotCategorySortedByOrder.find(sd => sd.name === s.name)
    );

    // Check if the slot is filled
    for (const categorySlot of categorySlots) {
      const categorySlotConfig = slotConfigurations.find(sc => sc.name === categorySlot.name);
      if (categorySlot.content.length > 0) {
        addToDimensions(dimensions, categorySlot.content[0], categorySlotConfig?.options?.isBinningDisabled);
      }
    }

    if (!hasMeasures && categorySlots.length > 0 && categorySlots[0].content.length > 0) {
      measures.push({ dataset_id: categorySlots[0].content[0].set, column_id: '*' });
    }
  }

  const query = {
    dimensions,
    measures,
    limit: { by: 60000 },
    options: { rollup_data: false }
  };

  return query;
};
