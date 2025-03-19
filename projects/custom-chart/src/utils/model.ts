import { Slot, SlotConfig } from "@luzmo/dashboard-contents-types";

// Define types for chart data
export interface ChartDataItem {
  category: string;
  group: string;
  value: number | string;  // Allow string values for formatted numbers
  rawValue: number;        // Store the raw numeric value for calculations
}

// Define types for chart configuration
export interface ChartDimensions {
  width: number;
  height: number;
}

// Define parameter types for render and resize functions
export interface ChartParams {
  container: HTMLElement;
  data: any[][];
  slots: Slot[];
  slotConfigurations: SlotConfig[];
  options: Record<string, any>;
  language: string;
  dimensions: ChartDimensions;
}
