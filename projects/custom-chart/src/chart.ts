import { Slot, SlotConfig } from '@luzmo/dashboard-contents-types';
import * as d3 from 'd3';

/**
 * Renders a custom chart inside the specified container element.
 *
 * @param container - The HTML element where the chart will be rendered.
 * @param data - An array of arrays, representing the data points to be plotted.
 * @param dimensions - An object containing the width, height, margin and padding of the chart.
 *
 */
export const render = (data: {
    container: HTMLElement,
    data: any[][],
    slots: Slot[],
    slotConfigurations: SlotConfig[],
    options: Record<string, any>,
    language: string,
    dimensions: { width: number; height: number }
  }
): void => {
  const width = data.dimensions.width ?? 800;
  const height = data.dimensions.height ?? 400;

  // Base design values
  const baseDotSize = 10;
  const baseGridSize = 20;
  const baseLetterSpacing = 50;
  const animationDuration = 200;

  // Define the letters as before.
  const letters = {
    L: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 4]],
    U: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [1, 4], [2, 4], [3, 0], [3, 1], [3, 2], [3, 3], [3, 4]],
    Z: [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [2, 2], [1, 3], [0, 4], [1, 4], [2, 4], [3, 4]],
    M: [[0, 4], [0, 3], [0, 2], [0, 1], [0, 0], [1, 1], [2, 2], [3, 1], [4, 0], [4, 1], [4, 2], [4, 3], [4, 4]],
    O: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1], [4, 2], [4, 3], [3, 4], [2, 4], [1, 4], [0, 3], [0, 2], [0, 1]]
  };

  // Calculate the total width and height of the design using the base values.
  // For each letter, the base width is (max x * baseGridSize + baseGridSize)
  const baseLetterWidths = Object.values(letters).map(
    l => Math.max(...l.map(([x]) => x)) * baseGridSize + baseGridSize
  );
  const baseTotalLetterWidth =
    baseLetterWidths.reduce((a, b) => a + b, 0) +
    baseLetterSpacing * (Object.keys(letters).length - 1);
  const baseTotalLetterHeight = 5 * baseGridSize;

  // Compute a scale factor such that the letters will fit in the canvas.
  // We use Math.min to only scale down (never scale up beyond our base design).
  const scale = Math.min(1, width / baseTotalLetterWidth, height / baseTotalLetterHeight);

  // Scale the design parameters
  const gridSize = baseGridSize * scale;
  const dotSize = baseDotSize * scale;
  const letterSpacing = baseLetterSpacing * scale;

  // Recalculate each letter's width using the scaled gridSize.
  const letterWidths = Object.values(letters).map(
    l => Math.max(...l.map(([x]) => x)) * gridSize + gridSize
  );
  const totalLetterWidth =
    letterWidths.reduce((a, b) => a + b, 0) + letterSpacing * (letterWidths.length - 1);

  // Center the letters within the canvas
  let offsetX = (width - totalLetterWidth) / 2;
  const offsetY = (height - 5 * gridSize) / 2;

  // Remove any existing canvas in the container.
  d3.select(data.container).selectAll('canvas').remove();

  // Create and configure a new canvas.
  const canvas = d3
    .select(data.container)
    .append('canvas')
    .attr('width', width)
    .attr('height', height)
    .style('display', 'block');

  const ctx = canvas.node()?.getContext('2d');
  if (!ctx) return;

  // Draw the background.
  ctx.fillStyle = '#262626';
  ctx.fillRect(0, 0, width, height);

  // Create an array to hold the dot data.
  let dots: { x: number; y: number; opacity: number; targetOpacity: number }[] = [];

  // Iterate over the letters and draw each dot.
  Object.entries(letters).forEach(([, positions], index) => {
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

    requestAnimationFrame(animate);
  }

  animate();

  // Optional: Update dot opacities on mouse move.
  canvas.on('mousemove', function (event) {
    const [mouseX, mouseY] = d3.pointer(event, canvas.node());
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
};


/**
 * Resizes the custom chart inside the specified container element.
 *
 * @param container - The HTML element where the chart will be rendered.
 * @param dimensions - An object containing the width, height, margin and padding of the chart.
 *
 */
export const resize = ( data: {
    container: HTMLElement,
    slots: Slot[],
    slotConfigurations: SlotConfig[],
    options: Record<string, any>,
    language: string,
    dimensions: { width: number; height: number }
  }
): void => {
  render({...data, data: []});
};

export const buildQuery = (slots: Slot[]): ItemQuery => {
  const query: ItemQuery = {
    dimensions: [],
    measures: [],
    limit: { by: 10000 }
  };

  return query;
}
