import { vizItemTypes } from '@luzmo/dashboard-contents-types';
import type { CustomChart } from './types';

export interface ChartCredentials {
  apiUrl: string;
  key: string;
  token: string;
}

export type ChartUpload =
  | { action: 'create'; type: string; name: string; zip: Blob }
  | { action: 'update'; id: string; zip: Blob };

export function chartTypeError(type: string): string | null {
  if (!/^[a-z0-9-]+$/.test(type)) {
    return 'Use only lowercase letters, numbers, and hyphens.';
  }
  if (type.length > 32) {
    return 'Chart type must be 32 characters or fewer.';
  }
  if (vizItemTypes.includes(type as (typeof vizItemTypes)[number])) {
    return `The chart type "${type}" is reserved for a built-in Luzmo chart.`;
  }
  return null;
}

export async function readChartResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    const message = body?.message ?? body?.error?.message ?? body?.error ?? body;
    throw new Error(`HTTP ${response.status}: ${
      typeof message === 'string' ? message : JSON.stringify(message) ?? 'Empty response body'
    }`);
  }
  return body;
}

export async function uploadCustomChart(
  credentials: ChartCredentials,
  options: ChartUpload
): Promise<CustomChart> {
  const form = new FormData();
  form.append('version', '0.1.0');
  form.append('action', options.action);
  form.append('key', credentials.key);
  form.append('token', credentials.token);
  if (options.action === 'create') {
    form.append('properties.name', JSON.stringify({ en: options.name }));
    form.append('properties.type', options.type);
  } else {
    form.append('id', options.id);
  }
  form.append('file', new Blob([options.zip], { type: 'application/zip' }), 'bundle.zip');

  try {
    const response = await fetch(`${credentials.apiUrl.replace(/\/$/, '')}/0.1.0/customchart`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(120_000),
      redirect: 'error'
    });
    return await readChartResponse(response) as CustomChart;
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error('Upload timed out after 120 seconds. Check the chart listing before retrying; the upload may have succeeded.');
    }
    throw error;
  }
}
